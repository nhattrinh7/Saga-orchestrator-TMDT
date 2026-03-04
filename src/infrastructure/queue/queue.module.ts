import { Module, forwardRef } from '@nestjs/common'
import { ApplicationModule } from '~/application/application.module'
import { BullModule } from '@nestjs/bullmq'
import { PaymentTimeoutService } from './payment-timeout.service'
import { PaymentTimeoutProcessor } from './payment-timeout.processor'
import { DatabaseModule } from '~/infrastructure/database/database.module'
import { MessagingModule } from '~/infrastructure/messaging/messaging.module'
import { WebSocketModule } from '~/infrastructure/websocket/websocket.module'
import { PAYMENT_QUEUE_NAME } from '~/common/constants/constant'

@Module({
  imports: [
    BullModule.registerQueue({
      name: PAYMENT_QUEUE_NAME,
    }),
    DatabaseModule,
    forwardRef(() => MessagingModule),
    WebSocketModule,
    forwardRef(() => ApplicationModule),
  ],
  providers: [
    PaymentTimeoutService,
    PaymentTimeoutProcessor,
  ],
  exports: [PaymentTimeoutService],
})
export class QueueModule {}
