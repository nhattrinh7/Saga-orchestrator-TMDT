import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { SagaController } from '~/presentation/v1/controllers/saga.controller'
import { ApplicationModule } from '~/application/application.module'
import { MessagingModule } from '~/infrastructure/messaging/messaging.module'

@Module({
  imports: [CqrsModule, ApplicationModule, MessagingModule],
  controllers: [SagaController],
  exports: [],
})
export class PresentationModule {}
