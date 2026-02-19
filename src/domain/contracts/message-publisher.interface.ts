export interface IMessagePublisher {
  emitToVoucherService<T>(pattern: string, event: T): void
}
export const MESSAGE_PUBLISHER = Symbol('MESSAGE_PUBLISHER')
