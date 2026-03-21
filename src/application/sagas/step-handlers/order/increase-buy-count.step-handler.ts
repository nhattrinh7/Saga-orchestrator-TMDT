import { Injectable } from '@nestjs/common'
import { ISagaStepHandler } from '~/domain/contracts/step-handler.interface'
import { SagaStepName } from '~/domain/enums/saga-step.enum'
import { Saga } from '~/domain/entities/saga.entity'

@Injectable()
export class IncreaseBuyCountStepHandler implements ISagaStepHandler {
  readonly stepName = SagaStepName.INCREASE_BUY_COUNT

  buildPayload(sagaId: string, saga: Saga): Record<string, any> {
    const { itemsByShop } = saga.data
    const allItems = Object.values(itemsByShop).flat() as Array<{
      productId: string
      quantity: number
    }>

    const quantities = new Map<string, number>()
    for (const item of allItems) {
      const current = quantities.get(item.productId) ?? 0
      quantities.set(item.productId, current + item.quantity)
    }

    const items = Array.from(quantities.entries()).map(([productId, quantity]) => ({
      productId,
      quantity,
    }))

    return {
      sagaId,
      items,
    }
  }

  buildCompensationPayload(): null {
    return null
  }
}
