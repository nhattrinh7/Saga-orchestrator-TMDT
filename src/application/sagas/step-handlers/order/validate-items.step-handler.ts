import { Injectable } from '@nestjs/common'
import { ISagaStepHandler } from '~/domain/contracts/step-handler.interface'
import { SagaStepName } from '~/domain/enums/saga-step.enum'
import { Saga } from '~/domain/entities/saga.entity'

/**
 * ValidateItemsStepHandler
 *
 * Chuẩn bị data cho step VALIDATE_ITEMS:
 * - Gom tất cả productVariantIds từ itemsByShop
 * - Gửi tới Catalog Service để validate
 *
 * Step này không cần compensation (validate không tạo side-effect)
 */
@Injectable()
export class ValidateItemsStepHandler implements ISagaStepHandler {
  readonly stepName = SagaStepName.VALIDATE_ITEMS

  buildPayload(sagaId: string, saga: Saga): Record<string, any> {
    const { itemsByShop } = saga.data
    const allVariantIds = Object.values(itemsByShop)
      .flat()
      .map((item: any) => item.productVariantId)

    return {
      sagaId,
      productVariantIds: allVariantIds,
    }
  }

  buildCompensationPayload(): null {
    // VALIDATE_ITEMS không tạo side-effect → không cần compensation
    return null
  }
}
