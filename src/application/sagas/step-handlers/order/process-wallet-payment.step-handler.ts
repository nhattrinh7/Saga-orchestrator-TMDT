import { Injectable } from '@nestjs/common'
import { ISagaStepHandler } from '~/domain/contracts/step-handler.interface'
import { SagaStepName } from '~/domain/enums/saga-step.enum'
import { Saga } from '~/domain/entities/saga.entity'

/**
 * ProcessWalletPaymentStepHandler
 *
 * Chuẩn bị data cho step PROCESS_WALLET_PAYMENT:
 * - Lấy finalPrice từ CALCULATE_AND_VERIFY_PRICE
 * - Gửi tới User Service để verify passcode + trừ tiền ví
 *
 * Lưu ý: Step này KHÔNG nằm trong main flow definition.
 * Nó được trigger riêng từ ConfirmWalletPaymentHandler khi user xác nhận thanh toán ví.
 * Nhưng handler vẫn cần cho engine biết cách build compensation payload.
 */
@Injectable()
export class ProcessWalletPaymentStepHandler implements ISagaStepHandler {
  readonly stepName = SagaStepName.PROCESS_WALLET_PAYMENT

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

  buildCompensationPayload(): null {
    // Wallet payment compensation được xử lý riêng (refund)
    return null
  }
}
