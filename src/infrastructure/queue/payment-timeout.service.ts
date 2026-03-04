import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { PAYMENT_TIMEOUT_MS, PAYMENT_QUEUE_NAME, PAYMENT_TIMEOUT_JOB_NAME } from '~/common/constants/constant'

/**
 * PaymentTimeoutService - Schedule/cancel timeout jobs
 */
@Injectable()
export class PaymentTimeoutService {
  constructor(
    @InjectQueue(PAYMENT_QUEUE_NAME) private readonly paymentTimeoutQueue: Queue,
  ) {}

  private readonly logger = new Logger(PaymentTimeoutService.name)

  async addPaymentTimeoutJob(sagaId: string, userId: string, delayMs: number = PAYMENT_TIMEOUT_MS): Promise<void> {
    await this.paymentTimeoutQueue.add(
      PAYMENT_TIMEOUT_JOB_NAME, // tên của job
      { sagaId, userId },       // data của job, dữ liệu cần khi job chạy
      {
        delay: delayMs,
        jobId: `timeout-${sagaId}`,
        removeOnComplete: true,
        removeOnFail: true,
      }
    )
    this.logger.log(`Payment timeout scheduled for saga ${sagaId} (${delayMs / 1000 / 60} min)`)
  }

  async removePaymentTimeoutJob(sagaId: string): Promise<void> {
    const job = await this.paymentTimeoutQueue.getJob(`timeout-${sagaId}`)
    if (job) {
      await job.remove()
      this.logger.log(`Payment timeout cancelled for saga ${sagaId}`)
    }
  }
}
