import { Module, forwardRef } from '@nestjs/common'
import { ClientsModule, Transport } from '@nestjs/microservices'
import { CqrsModule } from '@nestjs/cqrs'
import { MESSAGE_PUBLISHER } from '~/domain/contracts/message-publisher.interface'
import { RabbitMQPublisher } from '~/infrastructure/messaging/publishers/rabbitmq.publisher'
import { PaymentWebhookConsumer } from '~/infrastructure/messaging/consumers/payment-webhook.consumer'
import { SagaStepResultConsumer } from '~/infrastructure/messaging/consumers/saga-step-result.consumer'
import { DatabaseModule } from '~/infrastructure/database/database.module'
import { ApplicationModule } from '~/application/application.module'
import { QueueModule } from '~/infrastructure/queue/queue.module'

@Module({
  imports: [
    CqrsModule,
    DatabaseModule,
    forwardRef(() => ApplicationModule),
    forwardRef(() => QueueModule),
    ClientsModule.register([
      {
        name: 'CATALOG_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://admin:admin123@localhost:5672'],
          queue: 'catalog_queue',
          persistent: true,
        },
      },
      {
        name: 'USER_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://admin:admin123@localhost:5672'],
          queue: 'user_queue',
          persistent: true,
        },
      },
      {
        name: 'VOUCHER_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://admin:admin123@localhost:5672'],
          queue: 'voucher_queue',
          persistent: true,
        },
      },
      {
        name: 'INVENTORY_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://admin:admin123@localhost:5672'],
          queue: 'inventory_queue',
          persistent: true,
        },
      },
      {
        name: 'ORDER_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://admin:admin123@localhost:5672'],
          queue: 'order_queue',
          persistent: true,
        },
      },
      {
        name: 'PAYMENT_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://admin:admin123@localhost:5672'],
          queue: 'payment_queue',
          persistent: true,
        },
      },
      {
        name: 'NOTIFICATION_CLIENT',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://admin:admin123@localhost:5672'],
          queue: 'notification_queue',
          persistent: true,
        },
      },
    ]),
  ],
  controllers: [
    PaymentWebhookConsumer,
    SagaStepResultConsumer,
  ],
  providers: [
    {
      provide: MESSAGE_PUBLISHER,
      useClass: RabbitMQPublisher,
    },
  ],
  exports: [ClientsModule, MESSAGE_PUBLISHER],
})
export class MessagingModule {}
