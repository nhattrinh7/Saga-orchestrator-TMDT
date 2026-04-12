import { Injectable } from '@nestjs/common'
import { ISagaStepHandler } from '~/domain/contracts/step-handler.interface'
import { SagaStepName } from '~/domain/enums/saga-step.enum'

/**
 * StepHandlerRegistry - Registry trung tâm quản lý tất cả step handlers.
 *
 * Engine dùng registry này để tìm handler cho từng step:
 *   const handler = registry.get(SagaStepName.VALIDATE_ITEMS)
 *   const payload = handler.buildPayload(sagaId, saga, previousResults)
 *
 * Khi thêm saga mới, chỉ cần register thêm handlers vào registry.
 * Engine không cần thay đổi.
 */
@Injectable()
export class StepHandlerRegistry {
  /** Map stepName → handler instance */
  private readonly handlers = new Map<SagaStepName, ISagaStepHandler>()

  // Register 1 handler vào registry.
  // Thường được gọi trong constructor khi inject danh sách handlers.
  register(handler: ISagaStepHandler): void {
    if (this.handlers.has(handler.stepName)) {
      throw new Error(`Step handler for "${handler.stepName}" already registered`)
    }
    this.handlers.set(handler.stepName, handler)
  }

  // Lấy handler cho 1 step.
  // Throw error nếu không tìm thấy (lập trình viên quên register).
  get(stepName: SagaStepName): ISagaStepHandler {
    const handler = this.handlers.get(stepName)
    if (!handler) {
      throw new Error(
        `No step handler registered for "${stepName}". Did you forget to register it?`,
      )
    }
    return handler
  }

  // Kiểm tra handler đã được register chưa.
  has(stepName: SagaStepName): boolean {
    return this.handlers.has(stepName)
  }
}
