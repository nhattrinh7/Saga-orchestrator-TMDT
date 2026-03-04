/**
 * IPaymentNotifier - Interface để thông báo kết quả thanh toán tới user qua realtime channel.
 *
 * Application Layer (SagaEngine) dùng interface này để notify FE mà không biết
 * implementation cụ thể (WebSocket, SSE, Push Notification...).
 *
 * Implementation hiện tại: PaymentGateway (WebSocket via Socket.IO)
 */
export interface IPaymentNotifier {
  /** Thông báo thanh toán/đặt hàng thành công */
  emitPaymentSuccess(userId: string, data: { orderIds: string[]; message: string }): void

  /** Thông báo thanh toán thất bại */
  emitPaymentFailed(userId: string, data: { message: string }): void

  /** Thông báo hết thời gian thanh toán */
  emitPaymentTimeout(userId: string, data: { message: string }): void

  /** Gửi QR code URL cho thanh toán QRCODE */
  emitPaymentQRCode(userId: string, data: { qrUrl: string; amount: number; sagaId: string }): void
}

export const PAYMENT_NOTIFIER = Symbol('PAYMENT_NOTIFIER')
