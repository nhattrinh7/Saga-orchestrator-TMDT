import { Injectable } from '@nestjs/common'
import { ISagaStepHandler } from '~/domain/contracts/step-handler.interface'
import { SagaStepName } from '~/domain/enums/saga-step.enum'
import { Saga } from '~/domain/entities/saga.entity'

/**
 * ReserveInventoryStepHandler
 *
 * Chuẩn bị data cho step RESERVE_INVENTORY:
 * - Gom danh sách items (productVariantId + quantity)
 * - Gửi tới Inventory Service để giữ hàng
 *
 * Compensation: release-inventory (trả lại hàng đã giữ)
 */
@Injectable()
export class ReserveInventoryStepHandler implements ISagaStepHandler {
  readonly stepName = SagaStepName.RESERVE_INVENTORY

  buildPayload(sagaId: string, saga: Saga): Record<string, any> {
    const { itemsByShop } = saga.data
    const allItems = Object.values(itemsByShop).flat() as any[]

    return {
      sagaId,
      userId: saga.userId,
      items: allItems.map((item: any) => ({
        productVariantId: item.productVariantId,
        quantity: item.quantity,
      })),
    }
  }

  buildCompensationPayload(
    sagaId: string,
    _saga: Saga,
    stepResult: any,
    failureReason?: string,
  ): Record<string, any> {
    return {
      sagaId,
      reservationIds: stepResult?.reservationIds,
      failureReason: failureReason || 'Saga compensation',
    }
  }
}
