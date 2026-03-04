import { Injectable } from '@nestjs/common'
import { ISagaStepHandler } from '~/domain/contracts/step-handler.interface'
import { SagaStepName } from '~/domain/enums/saga-step.enum'
import { Saga } from '~/domain/entities/saga.entity'

/**
 * GetAddressStepHandler
 *
 * Chuẩn bị data cho step GET_ADDRESS:
 * - Gửi userId + addressId tới User Service để lấy địa chỉ giao hàng
 *
 * Step này không cần compensation
 */
@Injectable()
export class GetAddressStepHandler implements ISagaStepHandler {
  readonly stepName = SagaStepName.GET_ADDRESS

  buildPayload(sagaId: string, saga: Saga): Record<string, any> {
    return {
      sagaId,
      userId: saga.userId,
      addressId: saga.data.addressId,
    }
  }

  buildCompensationPayload(): null {
    return null
  }
}
