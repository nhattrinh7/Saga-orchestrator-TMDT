import { Module, Logger, forwardRef } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { DatabaseModule } from '~/infrastructure/database/database.module'
import { MessagingModule } from '~/infrastructure/messaging/messaging.module'
import { WebSocketModule } from '~/infrastructure/websocket/websocket.module'
import { QueueModule } from '~/infrastructure/queue/queue.module'
import { PlaceOrderHandler } from '~/application/commands/place-order/place-order.command.handler'
import { ConfirmWalletPaymentHandler } from '~/application/commands/confirm-wallet-payment/confirm-wallet-payment.command.handler'
import { SagaEngine } from '~/application/sagas/saga-engine.service'
import { StepHandlerRegistry } from '~/application/sagas/step-handler-registry.service'

// Import tất cả step handlers cho Order Saga
import {
  ValidateItemsStepHandler,
  GetAddressStepHandler,
  ValidateVouchersStepHandler,
  CalculateVerifyPriceStepHandler,
  ReserveInventoryStepHandler,
  CreatePaymentStepHandler,
  CreateOrdersStepHandler,
  ConfirmVouchersStepHandler,
  RemoveCartItemsStepHandler,
  IncreaseBuyCountStepHandler,
  ProcessWalletPaymentStepHandler,
} from '~/application/sagas/step-handlers/order'

// Khi thêm saga mới, import và thêm handlers vào đây.
const OrderSagaStepHandlers = [
  ValidateItemsStepHandler,
  GetAddressStepHandler,
  ValidateVouchersStepHandler,
  CalculateVerifyPriceStepHandler,
  ReserveInventoryStepHandler,
  CreatePaymentStepHandler,
  CreateOrdersStepHandler,
  ConfirmVouchersStepHandler,
  RemoveCartItemsStepHandler,
  IncreaseBuyCountStepHandler,
  ProcessWalletPaymentStepHandler,
]

const CommandHandlers = [PlaceOrderHandler, ConfirmWalletPaymentHandler]

const QueryHandlers = []

const EventHandlers = []

@Module({
  imports: [
    CqrsModule,
    DatabaseModule,
    forwardRef(() => MessagingModule),
    WebSocketModule,
    forwardRef(() => QueueModule),
  ],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    ...EventHandlers,

    // Saga Engine + Registry
    SagaEngine,
    {
      provide: StepHandlerRegistry,
      useFactory: (...handlers: any[]) => {
        const logger = new Logger('StepHandlerRegistry')
        const registry = new StepHandlerRegistry()
        for (const handler of handlers) {
          if (!handler) {
            logger.error('StepHandlerRegistry: handler is undefined/null, skipping')
            continue
          }
          logger.log(`StepHandlerRegistry: registering ${handler.stepName}`)
          registry.register(handler)
        }
        return registry
      },
      inject: OrderSagaStepHandlers,
    },

    // Step Handlers
    ...OrderSagaStepHandlers,
  ],
  exports: [SagaEngine],
})
export class ApplicationModule {}
