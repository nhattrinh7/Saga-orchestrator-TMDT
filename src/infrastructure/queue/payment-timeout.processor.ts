import { Inject, Logger, forwardRef } from '@nestjs/common'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import {
  type ISagaRepository,
  SAGA_REPOSITORY,
} from '~/domain/repositories/saga.repository.interface'
import { SagaStatus } from '~/domain/enums/saga.enum'
import { PAYMENT_QUEUE_NAME, PAYMENT_TIMEOUT_JOB_NAME } from '~/common/constants/constant'
import { SagaEngine } from '~/application/sagas/saga-engine.service'
import {
  type IPaymentNotifier,
  PAYMENT_NOTIFIER,
} from '~/domain/contracts/payment-notifier.interface'

/**
 * PaymentTimeoutProcessor - Process timeout events
 */
@Processor(PAYMENT_QUEUE_NAME)
export class PaymentTimeoutProcessor extends WorkerHost {
  constructor(
    @Inject(SAGA_REPOSITORY) private readonly sagaRepo: ISagaRepository,
    @Inject(forwardRef(() => SagaEngine))
    private readonly sagaEngine: SagaEngine,
    @Inject(PAYMENT_NOTIFIER) private readonly paymentNotifier: IPaymentNotifier,
  ) {
    super()
  }

  private readonly logger = new Logger(PaymentTimeoutProcessor.name)

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case PAYMENT_TIMEOUT_JOB_NAME:
        await this.handlePaymentTimeout(job)
        break
    }
  }

  private async handlePaymentTimeout(job: Job): Promise<void> {
    const { sagaId, userId } = job.data
    this.logger.log(`Payment timeout triggered for saga ${sagaId}`)

    const saga = await this.sagaRepo.findById(sagaId)
    if (!saga || saga.status !== SagaStatus.PROCESSING) {
      this.logger.log(`Saga ${sagaId} already processed, skipping timeout`)
      return
    }

    await this.sagaEngine.compensate(sagaId, 'Hết thời gian thanh toán (15 phút)')

    this.paymentNotifier.emitPaymentTimeout(userId, {
      message: 'Đã hết thời gian thanh toán. Đơn hàng đã bị hủy.',
    })
  }
}
