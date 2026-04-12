import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject, HttpException, HttpStatus } from '@nestjs/common'
import { ConfirmWalletPaymentCommand } from './confirm-wallet-payment.command'
import { ConfirmWalletPaymentResponseDto } from '~/presentation/dtos/place-order.dto'
import {
  type ISagaRepository,
  SAGA_REPOSITORY,
} from '~/domain/repositories/saga.repository.interface'
import {
  type ISagaStepRepository,
  SAGA_STEP_REPOSITORY,
} from '~/domain/repositories/saga-step.repository.interface'
import {
  type IMessagePublisher,
  MESSAGE_PUBLISHER,
} from '~/domain/contracts/message-publisher.interface'
import { SagaStatus } from '~/domain/enums/saga.enum'
import { SagaStepName, StepStatus } from '~/domain/enums/saga-step.enum'
import { PrismaService } from '~/infrastructure/database/prisma/prisma.service'

/**
 * ConfirmWalletPaymentHandler - Xác nhận thanh toán ví (event-driven)
 *
 * Flow: Verify saga state → emit PROCESS_WALLET_PAYMENT command → return ngay
 * → SagaStepManager xử lý tiếp khi nhận result
 */
@CommandHandler(ConfirmWalletPaymentCommand)
export class ConfirmWalletPaymentHandler implements ICommandHandler<ConfirmWalletPaymentCommand> {
  constructor(
    @Inject(SAGA_REPOSITORY) private readonly sagaRepo: ISagaRepository,
    @Inject(SAGA_STEP_REPOSITORY) private readonly sagaStepRepo: ISagaStepRepository,
    @Inject(MESSAGE_PUBLISHER) private readonly publisher: IMessagePublisher,
    private readonly prismaService: PrismaService,
  ) {}

  async execute(command: ConfirmWalletPaymentCommand): Promise<ConfirmWalletPaymentResponseDto> {
    const { sagaId, passcode } = command.data
    const { userId } = command

    // Validate saga
    const saga = await this.sagaRepo.findById(sagaId)
    if (!saga) {
      throw new HttpException({ success: false, error: 'Saga không tồn tại' }, HttpStatus.NOT_FOUND)
    }

    if (saga.userId !== userId) {
      throw new HttpException(
        { success: false, error: 'Không có quyền truy cập' },
        HttpStatus.FORBIDDEN,
      )
    }

    if (saga.status !== SagaStatus.PROCESSING) {
      throw new HttpException(
        { success: false, error: 'Saga không ở trạng thái chờ thanh toán' },
        HttpStatus.BAD_REQUEST,
      )
    }

    // Check payment method = WALLET
    const sagaData = saga.data
    if (sagaData.paymentMethod !== 'WALLET') {
      throw new HttpException(
        { success: false, error: 'Saga không phải thanh toán bằng ví' },
        HttpStatus.BAD_REQUEST,
      )
    }

    // Lấy amount từ CALCULATE_AND_VERIFY_PRICE step
    const calcStep = await this.sagaStepRepo.findStepByName(
      sagaId,
      SagaStepName.CALCULATE_AND_VERIFY_PRICE,
    )
    const amount = calcStep?.result?.finalPrice

    if (!amount) {
      throw new HttpException(
        { success: false, error: 'Không tìm thấy thông tin giá' },
        HttpStatus.BAD_REQUEST,
      )
    }

    // Kiểm tra saga đã halt sau CREATE_ORDERS chưa.
    // Tránh race condition: user nhập passcode quá nhanh khi saga vẫn đang chạy
    // RESERVE_INVENTORY / CREATE_ORDERS → compensation sẽ không tìm thấy orders để cancel.
    const createOrdersStep = await this.sagaStepRepo.findStepByName(
      sagaId,
      SagaStepName.CREATE_ORDERS,
    )
    if (!createOrdersStep || createOrdersStep.status !== StepStatus.COMPLETED) {
      throw new HttpException(
        { success: false, message: 'Đơn hàng chưa sẵn sàng để thanh toán, vui lòng thử lại' },
        HttpStatus.BAD_REQUEST,
      )
    }

    // Transaction: createStep + updateSagaStatus phải atomic
    await this.prismaService.transaction(async tx => {
      await this.sagaStepRepo.createStep(
        { sagaId, stepName: SagaStepName.PROCESS_WALLET_PAYMENT },
        tx,
      )
      await this.sagaRepo.updateSagaStatus(
        sagaId,
        SagaStatus.PROCESSING,
        { currentStep: SagaStepName.PROCESS_WALLET_PAYMENT },
        tx,
      )
    })

    // Emit event (ngoài transaction — fire-and-forget)
    this.publisher.emitToUserService('saga.verify-passcode-and-deduct', {
      sagaId,
      userId,
      passcode,
      amount,
    })

    return {
      success: true,
      message: 'Đang xử lý thanh toán ví',
    }
  }
}
