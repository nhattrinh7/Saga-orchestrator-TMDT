import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PaymentGateway } from './payment.gateway'
import { PAYMENT_NOTIFIER } from '~/domain/contracts/payment-notifier.interface'

@Module({
  imports: [JwtModule.register({})],
  providers: [
    PaymentGateway,
    {
      provide: PAYMENT_NOTIFIER,
      useExisting: PaymentGateway,
    },
  ],
  exports: [PAYMENT_NOTIFIER],
})
export class WebSocketModule {}
