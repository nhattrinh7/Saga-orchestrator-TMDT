import { Injectable } from '@nestjs/common'
import { ISagaStepHandler } from '~/domain/contracts/step-handler.interface'
import { SagaStepName } from '~/domain/enums/saga-step.enum'
import { Saga } from '~/domain/entities/saga.entity'

/**
 * RemoveCartItemsStepHandler
 *
 * Chuẩn bị data cho step REMOVE_CART_ITEMS:
 * - Gom danh sách productVariantIds từ itemsByShop
 * - Gửi tới User Service để xóa khỏi giỏ hàng
 *
 * Step này không cần compensation (xóa cart không cần rollback)
 */
@Injectable()
export class RemoveCartItemsStepHandler implements ISagaStepHandler {
  readonly stepName = SagaStepName.REMOVE_CART_ITEMS

  buildPayload(sagaId: string, saga: Saga): Record<string, any> {
    const { itemsByShop } = saga.data
    const allItems = Object.values(itemsByShop).flat() as any[]
    const productVariantIds = allItems.map((item: any) => item.productVariantId)

    return {
      sagaId,
      userId: saga.userId,
      productVariantIds,
    }
  }

  buildCompensationPayload(): null {
    // Xóa cart items không cần rollback
    return null
  }
}
