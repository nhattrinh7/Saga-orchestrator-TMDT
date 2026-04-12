import { Controller, Inject, forwardRef } from '@nestjs/common'
import { Payload, Ctx, RmqContext, EventPattern } from '@nestjs/microservices'
import { SagaEngine } from '~/application/sagas/saga-engine.service'
import { PaymentTimeoutService } from '~/infrastructure/queue/payment-timeout.service'
import { BaseRetryConsumer } from '~/common/utils/base-retry.consumer'

/**
 * PaymentWebhookConsumer - Nhận webhook events từ payment-service.
 *
 * Pattern: saga.payment-webhook
 * Được emit từ payment-service khi SePay webhook callback.
 */
@Controller()
export class PaymentWebhookConsumer extends BaseRetryConsumer {
  constructor(
    @Inject(forwardRef(() => SagaEngine))
    private readonly sagaEngine: SagaEngine,
    @Inject(forwardRef(() => PaymentTimeoutService))
    private readonly paymentTimeoutService: PaymentTimeoutService,
  ) {
    super()
  }

  @EventPattern('saga.payment-webhook')
  async handlePaymentWebhook(
    @Payload()
    data: {
      sagaId: string
      paymentId: string
      paymentCode: string
      transferAmount: number
      success: boolean
      error?: string
    },
    @Ctx() context: RmqContext,
  ) {
    await this.handleWithRetry(context, async () => {
      const { sagaId, success, error } = data

      if (!success) {
        // ***CÓ emitPaymentFailed trong compensate***
        // Thanh toán thất bại (sai số tiền, còn sai paymentCode sẽ ko bắn thì mốt coi như timeout) → compensation
        await this.sagaEngine.compensate(sagaId, error || 'Thanh toán thất bại')
        return
      }

      // Thanh toán thành công
      // Hủy timeout job
      await this.paymentTimeoutService.removePaymentTimeoutJob(sagaId)

      // ***CÓ emitPaymentSuccess trong handlePostPaymentSuccess***
      // Xử lý post-payment steps (update orders, confirm vouchers, remove cart)
      await this.sagaEngine.handlePostPaymentSuccess(sagaId, {
        paymentId: data.paymentId,
        paymentCode: data.paymentCode,
        transferAmount: data.transferAmount,
      })
    })
  }
}
