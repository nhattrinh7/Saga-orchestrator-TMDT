export interface IMessagePublisher {
  emitToCatalogService<T>(pattern: string, data: T): void
  emitToUserService<T>(pattern: string, data: T): void
  emitToVoucherService<T>(pattern: string, data: T): void
  emitToInventoryService<T>(pattern: string, data: T): void
  emitToOrderService<T>(pattern: string, data: T): void
  emitToPaymentService<T>(pattern: string, data: T): void
  emitToNotificationService<T>(pattern: string, data: T): void
}

export const MESSAGE_PUBLISHER = Symbol('MESSAGE_PUBLISHER')
