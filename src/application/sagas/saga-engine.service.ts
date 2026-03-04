import { Injectable, Inject, Logger } from '@nestjs/common'
import { type ISagaRepository, SAGA_REPOSITORY } from '~/domain/repositories/saga.repository.interface'
import { type ISagaStepRepository, SAGA_STEP_REPOSITORY } from '~/domain/repositories/saga-step.repository.interface'
import { type IMessagePublisher, MESSAGE_PUBLISHER } from '~/domain/contracts/message-publisher.interface'
import { SagaStatus } from '~/domain/enums/saga.enum'
import { StepStatus, SagaStepName } from '~/domain/enums/saga-step.enum'
import { SagaDefinition, StepDefinition, TargetService } from '~/domain/contracts/saga-definition.interface'
import { StepHandlerRegistry } from '~/application/sagas/step-handler-registry.service'
import { Saga } from '~/domain/entities/saga.entity'
import { type IPaymentNotifier, PAYMENT_NOTIFIER } from '~/domain/contracts/payment-notifier.interface'
import { getUsedVoucherIds } from '~/common/utils/get-used-voucher-ids.util'
import { PrismaService } from '~/infrastructure/database/prisma/prisma.service'

// Import saga definitions
import { ORDER_SAGA_DEFINITION } from '~/domain/saga-definitions/order-saga.definition'

/**
 * SagaEngine - Generic engine điều phối saga dựa trên definition.
 *
 * Engine KHÔNG biết business logic cụ thể (không biết voucher, inventory, payment...).
 * Nó chỉ biết:
 * 1. Đọc SagaDefinition để tìm step tiếp theo
 * 2. Gọi StepHandler để build payload
 * 3. Emit event qua IMessagePublisher
 * 4. Xử lý haltAfter (chờ external trigger)
 * 5. Xử lý compensation khi fail
 *
 * Khi thêm saga mới (Return, Refund...), chỉ cần:
 * - Tạo file definition mới
 * - Tạo các step handlers mới
 * - Register vào engine → DONE. Engine không cần sửa.
 */
@Injectable()
export class SagaEngine {
  private readonly logger = new Logger(SagaEngine.name)

  /**
   * Map sagaType → SagaDefinition.
   * Thêm saga mới → thêm 1 dòng ở đây.
   */
  private readonly definitions = new Map<string, SagaDefinition>()

  constructor(
    @Inject(SAGA_REPOSITORY) private readonly sagaRepo: ISagaRepository,
    @Inject(SAGA_STEP_REPOSITORY) private readonly sagaStepRepo: ISagaStepRepository,
    @Inject(MESSAGE_PUBLISHER) private readonly publisher: IMessagePublisher,
    private readonly handlerRegistry: StepHandlerRegistry,
    @Inject(PAYMENT_NOTIFIER) private readonly paymentNotifier: IPaymentNotifier,
    private readonly prismaService: PrismaService,
  ) {
    // Register tất cả saga definitions
    this.registerDefinition(ORDER_SAGA_DEFINITION)
    // Thêm saga mới ở đây:
    // this.registerDefinition(RETURN_SAGA_DEFINITION)
    // this.registerDefinition(REFUND_SAGA_DEFINITION)
  }

  // ==================== Public API ====================
  /**
   * Bắt đầu chạy saga sau khi đã tạo xong.
   * Entry point duy nhất để kick-off saga — Engine tự đọc definition
   * và kích hoạt các steps đầu tiên (dù là PARALLEL hay SEQUENTIAL).
   *
   * Gọi bởi: PlaceOrderHandler (hoặc bất kỳ handler nào tạo saga mới)
   */
  async startSaga(sagaId: string): Promise<void> {
    const saga = await this.sagaRepo.findById(sagaId)
    if (!saga) return

    await this.sagaRepo.updateSagaStatus(sagaId, SagaStatus.PROCESSING)
    await this.advanceToNextStep(sagaId, saga)
  }

  /**
   * Xử lý khi nhận được result từ 1 step.
   * Được gọi bởi consumer khi service trả kết quả về.
   *
   * Flow:
   * 1. Update step status
   * 2. Nếu fail → compensate
   * 3. Nếu success:
   *    a. Step có haltAfter trả true → dừng, chờ external trigger
   *    b. Step là post-payment (PROCESS_WALLET_PAYMENT) → handlePostPaymentSuccess
   *    c. Bình thường → advance tới step tiếp trong definition
   */
  async handleStepResult(sagaId: string, stepName: SagaStepName, result: any): Promise<void> {
    try {
      this.logger.log(`handleStepResult: sagaId=${sagaId}, step=${stepName}, success=${result.success}`)

      const saga = await this.sagaRepo.findById(sagaId)
      if (!saga || saga.status !== SagaStatus.PROCESSING) return

      // Tìm và update step hiện tại
      const step = await this.sagaStepRepo.findStepByName(sagaId, stepName)
      if (!step) return

      if (!result.success) {
        // Step thất bại → compensation
        await this.sagaStepRepo.updateStepStatus(step.id, StepStatus.FAILED, {
          error: { message: result.error },
        })
        await this.compensate(sagaId, result.error || `Step ${stepName} thất bại`)
        return
      }

      // Step thành công → update status
      await this.sagaStepRepo.updateStepStatus(step.id, StepStatus.COMPLETED, { result })

      // ===== Emit QR code cho QRCODE payment =====
      // Khi CREATE_PAYMENT xong → gửi QR URL về FE qua WebSocket
      // FE sẽ nhận event này và hiển thị QR dialog cho user quét
      if (stepName === SagaStepName.CREATE_PAYMENT && result.qrUrl) {
        this.paymentNotifier.emitPaymentQRCode(saga.userId, {
          qrUrl: result.qrUrl,
          amount: result.amount,
          sagaId,
        })
      }

      // ===== Post-payment step (PROCESS_WALLET_PAYMENT) =====
      // Step này KHÔNG nằm trong definition phases (trigger bởi external ConfirmWalletPaymentHandler).
      // Khi wallet thành công → chạy post-payment flow: update orders, confirm vouchers, remove cart.
      if (stepName === SagaStepName.PROCESS_WALLET_PAYMENT) {
        await this.handlePostPaymentSuccess(sagaId, result)
        return
      }

      // ===== Check haltAfter trong definition =====
      // Nếu step vừa completed có haltAfter trả true → dừng engine, chờ external trigger.
      // Ví dụ: CREATE_ORDERS xong + payment WALLET/QRCODE → engine halt.
      const definition = this.getDefinition(saga.sagaType)
      const stepDef = this.findStepDefinition(definition, stepName)
      if (stepDef?.haltAfter?.(saga.data)) {
        // Saga vẫn PROCESSING nhưng KHÔNG advance.
        // Khi external trigger đến (wallet/webhook) → `handlePostPaymentSuccess`() sẽ hoàn tất saga.

        // Gọi afterComplete của handler nếu có (ví dụ: CreateOrdersStepHandler schedule payment timeout)
        const handler = this.handlerRegistry.has(stepName) ? this.handlerRegistry.get(stepName) : null
        if (handler?.afterComplete) {
          await handler.afterComplete(sagaId, saga, result)
        }
        return
      }

      // ===== Bình thường: advance tới step tiếp =====
      await this.advanceToNextStep(sagaId, saga)
    } catch (error: any) {
      this.logger.error(`handleStepResult CRASHED: sagaId=${sagaId}, step=${stepName}, ${error.message}`)
      throw error // re-throw để consumer retry
    }
  }

  /**
   * Xử lý post-payment cho WALLET/QRCODE.
   * Khi thanh toán thành công, chạy các side-effects còn lại (fire-and-forget):
   * 1. Update orders → AWAITING_CONFIRMATION
   * 2. Confirm vouchers
   * 3. Xóa cart items
   * 4. Complete saga
   *
   * Gọi bởi:
   * - PaymentWebhookConsumer (QRCODE thành công qua SePay)
   * - handleStepResult khi PROCESS_WALLET_PAYMENT thành công
   */
  async handlePostPaymentSuccess(sagaId: string, _stepResult: any): Promise<void> {
    const saga = await this.sagaRepo.findById(sagaId)
    if (!saga) return

    const { itemsByShop, shopVouchers, szoneVoucherId } = saga.data

    // Lấy orderIds từ CREATE_ORDERS step
    const createOrdersStep = await this.sagaStepRepo.findStepByName(sagaId, SagaStepName.CREATE_ORDERS)
    const orderIds = createOrdersStep?.result?.orderIds || []

    // 1. Update orders → AWAITING_CONFIRMATION
    this.emitToService('order', 'saga.update-orders-status', {
      sagaId, orderIds, status: 'AWAITING_CONFIRMATION',
    })

    // 2. Confirm vouchers (nếu có)
    const voucherIds = getUsedVoucherIds(shopVouchers, szoneVoucherId)
    if (voucherIds.length > 0) {
      this.emitToService('voucher', 'saga.confirm-vouchers', {
        sagaId, userId: saga.userId, voucherIds,
      })
    }

    // 3. Xóa cart items
    const allItems = Object.values(itemsByShop).flat() as any[]
    const productVariantIds = allItems.map((item: any) => item.productVariantId)
    this.emitToService('user', 'saga.remove-cart-items', {
      sagaId, userId: saga.userId, productVariantIds,
    })

    // 4. Hoàn thành saga
    await this.sagaRepo.updateSagaStatus(sagaId, SagaStatus.COMPLETED, {
      currentStep: null,
      completedAt: new Date(),
    })

    // 5. Notify FE
    this.paymentNotifier.emitPaymentSuccess(saga.userId, {
      orderIds,
      message: 'Thanh toán thành công',
    })
  }

  /**
   * Compensation — rollback tất cả completed steps khi saga fail.
   * Đọc compensation config từ definition để biết cần emit event gì.
   */
  async compensate(sagaId: string, failureReason: string): Promise<void> {
    const saga = await this.sagaRepo.findById(sagaId)
    if (!saga) return

    const definition = this.getDefinition(saga.sagaType)
    await this.sagaRepo.updateSagaStatus(sagaId, SagaStatus.COMPENSATING, { failureReason })

    const completedSteps = await this.sagaStepRepo.findCompletedSteps(sagaId)
    this.logger.log(`compensate: sagaId=${sagaId}, reason="${failureReason}", completedSteps=[${completedSteps.map(s => s.stepName).join(', ')}]`)

    for (const step of completedSteps) {  
      try {
        // Tìm compensation config trong definition
        const compDef = definition.compensation[step.stepName]
        if (!compDef) {
          this.logger.log(`compensate: step ${step.stepName} — không có compensation config, bỏ qua`)
          continue // Step này không cần compensate
        }

        // Dùng handler để build compensation payload
        const handler = this.handlerRegistry.has(step.stepName)
          ? this.handlerRegistry.get(step.stepName)
          : null

        if (handler) {
          const payload = handler.buildCompensationPayload(sagaId, saga, step.result, failureReason)
          this.logger.log(`compensate: step ${step.stepName} → event=${compDef.event}`)
          if (payload) {
            this.emitToService(compDef.service, compDef.event, payload)
          }
        } else {
          this.logger.warn(`compensate: step ${step.stepName} — handler KHÔNG tìm thấy, bỏ qua compensation`)
        }

        await this.sagaStepRepo.updateStepStatus(step.id, StepStatus.COMPENSATED)
      } catch (error: any) {
        this.logger.error(`Compensation failed for step ${step.stepName}: ${error.message}`)
      }
    }

    await this.sagaRepo.updateSagaStatus(sagaId, SagaStatus.COMPENSATED, {
      compensatedAt: new Date(),
      currentStep: null,
    })

    // Notify FE qua WebSocket
    this.paymentNotifier.emitPaymentFailed(saga.userId, {
      message: failureReason,
    })
  }

  // ==================== Core Engine Logic ====================
  /**
   * Tìm và thực thi step tiếp theo dựa trên definition.
   *
   * Algorithm:
   * 1. Duyệt qua từng phase trong definition
   * 2. Nếu PARALLEL: check tất cả steps đã completed → tiến tiếp
   * 3. Nếu SEQUENTIAL: tìm step chưa completed đầu tiên → thực thi
   * 4. Nếu hết steps → saga completed
   */
  // "Dựa vào những gì đã xong trong DB, bước tiếp theo là gì?"
  private async advanceToNextStep(sagaId: string, saga: Saga): Promise<void> {
    const definition = this.getDefinition(saga.sagaType)

    // Lấy danh sách steps đã completed
    const completedSteps = await this.sagaStepRepo.findCompletedSteps(sagaId)
    const completedNames = new Set(completedSteps.map(s => s.stepName))

    // Collect previous results cho step handlers (Map stepName → result)
    const previousResults = new Map<SagaStepName, any>()
    for (const step of completedSteps) {
      previousResults.set(step.stepName, step.result)
    }

    // Duyệt qua từng phase theo thứ tự
    for (const phase of definition.phases) {
      if (phase.type === 'PARALLEL') {
        // Lọc ra các step không bị skip
        // Những bước không có skipWhen (mặc định là phải làm).
        // Những bước có skipWhen nhưng điều kiện đó trả về false (nghĩa là không skip trong trường hợp này).
        const activeSteps = phase.steps.filter(s => !s.skipWhen?.(saga.data))

        // Mọi step trong activeSteps có đều nằm trong danh sách step đã hoàn thành hay không
        const allDone = activeSteps.every(s => completedNames.has(s.name))

        if (!allDone) {
          // Chưa xong hết → kiểm tra và kích hoạt các step chưa bắt đầu
          // Với mỗi step active chưa completed, kiểm tra xem nó đã có step record trong DB chưa:
          //   - Nếu chưa có → chưa bắt đầu → gọi executeStep để kích hoạt
          //   - Nếu đã có → đang chạy rồi → bỏ qua, chờ result quay về
          for (const stepDef of activeSteps) {
            if (completedNames.has(stepDef.name)) continue
            const existingStep = await this.sagaStepRepo.findStepByName(sagaId, stepDef.name)
            if (!existingStep) {
              await this.executeStep(sagaId, saga, stepDef, previousResults)
            }
          }
          // Đã kích hoạt hết các step chưa bắt đầu → return, chờ tất cả hoàn thành
          return
        }
        // Phase parallel đã xong → tiếp tục check phase tiếp theo
        continue
      }

      if (phase.type === 'SEQUENTIAL') {
        for (const stepDef of phase.steps) {
          // Bỏ qua step đã completed
          if (completedNames.has(stepDef.name)) continue

          // Bỏ qua step bị skip theo điều kiện
          if (stepDef.skipWhen?.(saga.data)) continue

          // Đây là step tiếp theo cần thực thi!
          await this.executeStep(sagaId, saga, stepDef, previousResults)
          return
        }
        // Hết steps trong sequential phase → tiếp tục phase tiếp
        continue
      }
    }

    // Hết tất cả phases → saga hoàn thành
    await this.sagaRepo.updateSagaStatus(sagaId, SagaStatus.COMPLETED, {
      currentStep: null,
      completedAt: new Date(),
    })

    // Notify FE thành công
    const createOrdersStep = await this.sagaStepRepo.findStepByName(sagaId, SagaStepName.CREATE_ORDERS)
    const orderIds = createOrdersStep?.result?.orderIds || []
    this.paymentNotifier.emitPaymentSuccess(saga.userId, {
      orderIds,
      message: 'Đặt hàng thành công',
    })
  }

  /**
   * Thực thi 1 step cụ thể.
   *
   * - Local step: gọi handler.executeLocal() → update result → check haltAfter → tự advance tiếp
   * - Remote step: build payload → emit event → chờ result quay về qua consumer
   */
  private async executeStep(
    sagaId: string,
    saga: Saga,
    stepDef: StepDefinition,
    previousResults: Map<SagaStepName, any>,
  ): Promise<void> {
    const handler = this.handlerRegistry.get(stepDef.name)

    if (stepDef.isLocal) {
      // ===== Local Step =====
      if (!handler.executeLocal) {
        throw new Error(`Step "${stepDef.name}" is marked as local but handler has no executeLocal()`)
      }

      // Transaction: createStep + updateSagaStatus phải atomic
      const stepId = await this.prismaService.transaction(async (tx) => {
        const id = await this.sagaStepRepo.createStep({ sagaId, stepName: stepDef.name }, tx)
        await this.sagaRepo.updateSagaStatus(sagaId, SagaStatus.PROCESSING, { currentStep: stepDef.name }, tx)
        return id
      })

      try {
        const result = await handler.executeLocal(sagaId, saga, previousResults)
        await this.sagaStepRepo.updateStepStatus(stepId, StepStatus.COMPLETED, { result })

        // Check haltAfter cho local step
        if (stepDef.haltAfter?.(saga.data)) {
          return // Dừng, chờ external trigger
        }

        // Local step xong → cập nhật previousResults và tự advance tiếp
        previousResults.set(stepDef.name, result)

        // Trước khi advanceToNextStep thì lấy saga từ trong db ra dùng, lí do là
        // 1. Nếu có 1 step khác chạy song song rồi thất bại và trạng thái của saga đã thành COMPENSATING, nếu vẫn dùng saga cũ PROCESSING thì 
        // sẽ tiếp tục thực hiện tiếp trong khi saga đáng lẽ phải dừng, điều này nguy hiểm
        // 2. Các bước song song khác có thể đã hoàn thành, trước khi chạy bước tiếp theo thì lấy saga trong DB để đảm bảo 
        // saga lúc này chứa các thông tin mới nhất, chứa thông tin các step song song vừa mới hoàn thành kia
        // 3. Engine dc thiết kế theo hướng "State Machine". Nguyên tắc vàng của State Machine là luôn đưa ra quyết định dựa trên
        // trạng thái thực tế cuối cùng của hệ thống.
        const freshSaga = await this.sagaRepo.findById(sagaId)
        if (freshSaga && freshSaga.status === SagaStatus.PROCESSING) {
          await this.advanceToNextStep(sagaId, freshSaga)
        }
      } catch (error: any) {
        // Local step thất bại → compensation
        await this.sagaStepRepo.updateStepStatus(stepId, StepStatus.FAILED, {
          error: { message: error.message },
        })
        await this.compensate(sagaId, error.message)
      }
      return
    }

    // ===== Remote Step =====
    if (!stepDef.service || !stepDef.event) {
      throw new Error(`Step "${stepDef.name}" is remote but missing service or event`)
    }

    const payload = handler.buildPayload(sagaId, saga, previousResults)

    // Transaction: createStep + updateSagaStatus phải atomic
    await this.prismaService.transaction(async (tx) => {
      await this.sagaStepRepo.createStep({ sagaId, stepName: stepDef.name }, tx)
      await this.sagaRepo.updateSagaStatus(sagaId, SagaStatus.PROCESSING, { currentStep: stepDef.name }, tx)
    })

    this.emitToService(stepDef.service, stepDef.event, payload)
    // Remote step: chờ result quay về qua consumer → handleStepResult()
  }


  // ==================== Helpers ====================

  // Tìm step definition trong tất cả phases của 1 saga.
  // Dùng để check haltAfter sau khi step hoàn thành.
  private findStepDefinition(definition: SagaDefinition, stepName: SagaStepName): StepDefinition | null {
    for (const phase of definition.phases) {
      const step = phase.steps.find(s => s.name === stepName)
      if (step) return step
    }
    return null
  }

  // Emit message tới service đích.
  // Map tên service → method tương ứng trên IMessagePublisher.
  private emitToService(service: TargetService, event: string, payload: any): void {
    const emitterMap: Record<TargetService, (event: string, data: any) => void> = {
      catalog: (e, d) => this.publisher.emitToCatalogService(e, d),
      user: (e, d) => this.publisher.emitToUserService(e, d),
      voucher: (e, d) => this.publisher.emitToVoucherService(e, d),
      inventory: (e, d) => this.publisher.emitToInventoryService(e, d),
      order: (e, d) => this.publisher.emitToOrderService(e, d),
      payment: (e, d) => this.publisher.emitToPaymentService(e, d),
      notification: (e, d) => this.publisher.emitToNotificationService(e, d),
    }

    const emitter = emitterMap[service]
    if (!emitter) {
      throw new Error(`Unknown target service: "${service}"`)
    }
    emitter(event, payload)
  }

  // Lấy definition cho 1 saga type.
  // Throw nếu chưa register (lập trình viên quên thêm).
  private getDefinition(sagaType: string): SagaDefinition {
    const definition = this.definitions.get(sagaType)
    if (!definition) {
      throw new Error(`No saga definition registered for type "${sagaType}". Did you forget to register it?`)
    }
    return definition
  }

  // Register 1 saga definition vào engine.
  private registerDefinition(definition: SagaDefinition): void {
    this.definitions.set(definition.sagaType, definition)
  }

}
