import { SagaStepName } from '~/domain/enums/saga-step.enum'
import { Saga } from '~/domain/entities/saga.entity'

/**
 * ISagaStepHandler - Interface cho mỗi step handler.
 *
 * Mỗi step trong saga có 1 handler riêng, chịu trách nhiệm:
 * 1. buildPayload: Chuẩn bị data để emit tới service đích
 * 2. buildCompensationPayload: Chuẩn bị data để rollback step này
 * 3. executeLocal (optional): Xử lý step local (không emit event)
 *
 * Handler KHÔNG biết flow — chỉ biết step của mình.
 * Flow do SagaDefinition quyết định, engine điều phối.
 */
export interface ISagaStepHandler {
  /**
   * Tên step mà handler này phụ trách.
   * Dùng để engine tự động map handler → step.
   */
  readonly stepName: SagaStepName

  /**
   * Chuẩn bị payload để emit tới service đích.
   *
   * @param sagaId - ID của saga hiện tại
   * @param saga - Entity saga (chứa userId, data, ...)
   * @param previousResults - Kết quả của các steps đã hoàn thành trước đó
   * @returns Payload object để emit qua RabbitMQ
   */
  buildPayload(
    sagaId: string,
    saga: Saga,
    previousResults: Map<SagaStepName, any>,
  ): Record<string, any>

  /**
   * Chuẩn bị payload cho compensation (rollback).
   * Trả về null nếu step không cần compensation.
   *
   * @param sagaId - ID của saga hiện tại
   * @param saga - Entity saga
   * @param stepResult - Kết quả của step này khi đã completed
   * @param failureReason - Lý do saga fail (dùng để xác định loại cancel)
   * @returns Payload cho compensation, hoặc null nếu không cần
   */
  buildCompensationPayload(
    sagaId: string,
    saga: Saga,
    stepResult: any,
    failureReason?: string,
  ): Record<string, any> | null

  /**
   * Xử lý step local (không emit event ra ngoài).
   * Chỉ implement cho local steps (ví dụ: CALCULATE_AND_VERIFY_PRICE).
   * Remote steps không cần implement method này.
   *
   * @param sagaId - ID của saga hiện tại
   * @param saga - Entity saga
   * @param previousResults - Kết quả của các steps trước
   * @returns Kết quả xử lý, hoặc throw error nếu thất bại
   */
  executeLocal?(
    sagaId: string,
    saga: Saga,
    previousResults: Map<SagaStepName, any>,
  ): any

  /**
   * Hook chạy sau khi step hoàn thành thành công.
   * Dùng cho side-effects riêng của step (ví dụ: schedule payment timeout).
   * Engine gọi method này sau khi update step status = COMPLETED.
   * Optional — chỉ implement khi step cần side-effects.
   */
  afterComplete?(
    sagaId: string,
    saga: Saga,
    stepResult: any,
  ): Promise<void>
}
