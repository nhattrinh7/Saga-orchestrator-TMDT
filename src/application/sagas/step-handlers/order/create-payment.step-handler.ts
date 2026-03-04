import { Injectable } from '@nestjs/common'
import { ISagaStepHandler } from '~/domain/contracts/step-handler.interface'
import { SagaStepName } from '~/domain/enums/saga-step.enum'
import { Saga } from '~/domain/entities/saga.entity'

/**
 * CreatePaymentStepHandler
 *
 * Chuẩn bị data cho step CREATE_PAYMENT:
 * - Lấy finalPrice từ CALCULATE_AND_VERIFY_PRICE step
 * - Gửi tới Payment Service để tạo thanh toán (QR code)
 *
 * Compensation: cancel-payment (hủy thanh toán đã tạo)
 */
@Injectable()
export class CreatePaymentStepHandler implements ISagaStepHandler {
  readonly stepName = SagaStepName.CREATE_PAYMENT

  buildPayload(
    sagaId: string,
    saga: Saga,
    previousResults: Map<SagaStepName, any>,
  ): Record<string, any> {
    const calcResult = previousResults.get(SagaStepName.CALCULATE_AND_VERIFY_PRICE)
    return {
      sagaId,
      userId: saga.userId,
      amount: calcResult?.finalPrice,
    }
  }

  buildCompensationPayload(sagaId: string, _saga: Saga, stepResult: any): Record<string, any> {
    return {
      sagaId,
      paymentId: stepResult?.paymentId,
    }
  }
}
