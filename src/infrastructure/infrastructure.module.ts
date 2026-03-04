import { Module } from '@nestjs/common'
import { DatabaseModule } from '~/infrastructure/database/database.module'
import { MessagingModule } from '~/infrastructure/messaging/messaging.module'
import { WebSocketModule } from '~/infrastructure/websocket/websocket.module'
import { QueueModule } from '~/infrastructure/queue/queue.module'

@Module({
  imports: [DatabaseModule, MessagingModule, WebSocketModule, QueueModule],
  providers: [],
  exports: [],
})
export class InfrastructureModule {}
