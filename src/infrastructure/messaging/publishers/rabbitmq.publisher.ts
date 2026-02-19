import { Injectable, Inject } from '@nestjs/common'
import { ClientProxy } from '@nestjs/microservices'
import { IMessagePublisher } from '~/domain/contracts/message-publisher.interface'

@Injectable()
export class RabbitMQPublisher implements IMessagePublisher {
  constructor(
    @Inject('NOTIFICATION_CLIENT') 
    private readonly notificationClient: ClientProxy,
    @Inject('SHOP_CLIENT') 
    private readonly shopClient: ClientProxy,
    @Inject('USER_CLIENT') 
    private readonly userClient: ClientProxy,
    @Inject('CATALOG_CLIENT')
    private readonly catalogClient: ClientProxy,
    @Inject('VOUCHER_CLIENT')
    private readonly voucherClient: ClientProxy,
  ) {}

  emitToVoucherService<T>(pattern: string, event: T): void {
    this.voucherClient.emit(pattern, event)
  }
}