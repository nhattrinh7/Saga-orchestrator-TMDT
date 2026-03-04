import { SagaStepName } from '~/domain/enums/saga-step.enum'

/**
 * TargetService - Tên service đích để emit message tới.
 * Phải khớp với các method emitToXxxService() trong IMessagePublisher.
 */
export type TargetService =
  | 'catalog'
  | 'user'
  | 'voucher'
  | 'inventory'
  | 'order'
  | 'payment'
  | 'notification'

// ==================== Step Definition ====================
/**
 * StepDefinition - Khai báo 1 step trong saga.
 *
 * Có 2 loại step:
 * - Remote step: emit event tới service khác, chờ result trả về
 * - Local step: xử lý ngay tại orchestrator (ví dụ: tính giá)
 */
export interface StepDefinition {
  /** Tên step, tương ứng với SagaStepName enum */
  name: SagaStepName

  /** Service đích để emit event (bỏ qua nếu là local step) */
  service?: TargetService

  /** Event pattern để emit qua RabbitMQ (bỏ qua nếu là local step) */
  event?: string

  /**
   * Đánh dấu step chạy local (không emit event).
   * Ví dụ: CALCULATE_AND_VERIFY_PRICE tính toán ngay tại orchestrator.
   */
  isLocal?: boolean

  /**
   * Điều kiện skip step.
   * Trả về true → bỏ qua step này, tiến tới step tiếp theo.
   * Ví dụ: skip VALIDATE_VOUCHERS nếu không có voucher nào.
   */
  skipWhen?: (sagaData: any) => boolean

  /**
   * Điều kiện dừng saga sau khi step hoàn thành.
   * Trả về true → saga vẫn giữ status PROCESSING nhưng KHÔNG advance tiếp.
   * Chờ external trigger (ví dụ: wallet confirmation, QR webhook) để tiếp tục.
   *
   * Ví dụ: CREATE_ORDERS xong + paymentMethod không phải COD
   * → dừng chờ thanh toán, KHÔNG advance tới CONFIRM_VOUCHERS.
   */
  haltAfter?: (sagaData: any) => boolean
}

// ==================== Phase Definition ====================
/**
 * ParallelPhase - Nhóm các steps chạy song song.
 * Engine sẽ emit tất cả steps cùng lúc và chờ tất cả completed mới tiến tiếp.
 *
 * Ví dụ: VALIDATE_ITEMS + GET_ADDRESS chạy cùng lúc.
 */
export interface ParallelPhase {
  type: 'PARALLEL'
  steps: StepDefinition[]
}

/**
 * SequentialPhase - Nhóm các steps chạy tuần tự.
 * Engine chạy từng step một, step trước xong mới chạy step sau.
 */
export interface SequentialPhase {
  type: 'SEQUENTIAL'
  steps: StepDefinition[]
}

/** Một phase có thể là parallel hoặc sequential */
export type PhaseDefinition = ParallelPhase | SequentialPhase

// ==================== Compensation Definition ====================

/**
 * CompensationDefinition - Khai báo cách rollback cho 1 step.
 * Khi saga fail, engine sẽ duyệt ngược các completed steps
 * và gọi compensation tương ứng.
 */
export interface CompensationDefinition {
  /** Event pattern để emit compensation command */
  event: string

  /** Service đích để gửi compensation command */
  service: TargetService
}

// ==================== Saga Definition ====================

/**
 * SagaDefinition - Toàn bộ khai báo cho 1 saga flow.
 *
 * Đây là "kịch bản" mà SagaEngine sẽ đọc và thực thi.
 * Nhìn vào file definition là hiểu ngay toàn bộ flow,
 * không cần đọc logic engine.
 */
export interface SagaDefinition {
  /** Loại saga (ví dụ: ORDER_SAGA, RETURN_SAGA) */
  sagaType: string

  /** Danh sách các phases theo thứ tự thực thi */
  phases: PhaseDefinition[]

  /**
   * Mapping step → compensation action.
   * Chỉ khai báo cho các steps CẦN rollback.
   * Steps không có ở đây sẽ bị bỏ qua khi compensate.
   */
  compensation: Partial<Record<SagaStepName, CompensationDefinition>>
}
