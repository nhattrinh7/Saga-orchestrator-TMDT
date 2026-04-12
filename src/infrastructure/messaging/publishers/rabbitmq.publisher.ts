import { Injectable, Inject, Logger } from '@nestjs/common'
import { ClientProxy, RmqRecordBuilder } from '@nestjs/microservices'
import { IMessagePublisher } from '~/domain/contracts/message-publisher.interface'
import { getKongRequestId } from '~/common/context/request-context'

@Injectable()
export class RabbitMQPublisher implements IMessagePublisher {
  private readonly logger = new Logger(RabbitMQPublisher.name)

  constructor(
    @Inject('CATALOG_CLIENT') private readonly catalogClient: ClientProxy,
    @Inject('USER_CLIENT') private readonly userClient: ClientProxy,
    @Inject('VOUCHER_CLIENT') private readonly voucherClient: ClientProxy,
    @Inject('INVENTORY_CLIENT') private readonly inventoryClient: ClientProxy,
    @Inject('ORDER_CLIENT') private readonly orderClient: ClientProxy,
    @Inject('PAYMENT_CLIENT') private readonly paymentClient: ClientProxy,
    @Inject('NOTIFICATION_CLIENT') private readonly notificationClient: ClientProxy,
  ) {}

  private buildRecord<T>(event: T) {
    return new RmqRecordBuilder(event)
      .setOptions({
        headers: { 'kong-request-id': getKongRequestId() },
      })
      .build()
  }

  emitToCatalogService<T>(pattern: string, data: T): void {
    this.logger.debug(`[${getKongRequestId()}] Emit ${pattern} → catalog-service`)
    this.catalogClient.emit(pattern, this.buildRecord(data))
  }

  emitToUserService<T>(pattern: string, data: T): void {
    this.logger.debug(`[${getKongRequestId()}] Emit ${pattern} → user-service`)
    this.userClient.emit(pattern, this.buildRecord(data))
  }

  emitToVoucherService<T>(pattern: string, data: T): void {
    this.logger.debug(`[${getKongRequestId()}] Emit ${pattern} → voucher-service`)
    this.voucherClient.emit(pattern, this.buildRecord(data))
  }

  emitToInventoryService<T>(pattern: string, data: T): void {
    this.logger.debug(`[${getKongRequestId()}] Emit ${pattern} → inventory-service`)
    this.inventoryClient.emit(pattern, this.buildRecord(data))
  }

  emitToOrderService<T>(pattern: string, data: T): void {
    this.logger.debug(`[${getKongRequestId()}] Emit ${pattern} → order-service`)
    this.orderClient.emit(pattern, this.buildRecord(data))
  }

  emitToPaymentService<T>(pattern: string, data: T): void {
    this.logger.debug(`[${getKongRequestId()}] Emit ${pattern} → payment-service`)
    this.paymentClient.emit(pattern, this.buildRecord(data))
  }

  emitToNotificationService<T>(pattern: string, data: T): void {
    this.logger.debug(`[${getKongRequestId()}] Emit ${pattern} → notification-service`)
    this.notificationClient.emit(pattern, this.buildRecord(data))
  }
}
