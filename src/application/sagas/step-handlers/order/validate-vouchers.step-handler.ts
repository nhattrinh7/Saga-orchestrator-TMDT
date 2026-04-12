import { Injectable } from '@nestjs/common'
import { ISagaStepHandler } from '~/domain/contracts/step-handler.interface'
import { SagaStepName } from '~/domain/enums/saga-step.enum'
import { Saga } from '~/domain/entities/saga.entity'
import { getUsedVoucherIds } from '~/common/utils/get-used-voucher-ids.util'

/**
 * ValidateVouchersStepHandler
 *
 * Chuẩn bị data cho step VALIDATE_VOUCHERS:
 * - Tính orderValue cho từng shop (dựa vào variants từ VALIDATE_ITEMS)
 * - Chuẩn bị shopVoucherData + szoneVoucherData
 * - Gửi tới Voucher Service để validate
 *
 * Compensation: Gửi cancel-vouchers để hủy hold voucher
 */
@Injectable()
export class ValidateVouchersStepHandler implements ISagaStepHandler {
  readonly stepName = SagaStepName.VALIDATE_VOUCHERS

  buildPayload(
    sagaId: string,
    saga: Saga,
    previousResults: Map<SagaStepName, any>,
  ): Record<string, any> {
    const { shopVouchers, szoneVoucherId, itemsByShop } = saga.data
    const variants = previousResults.get(SagaStepName.VALIDATE_ITEMS)?.variants || []

    // Chuẩn bị data cho từng shop voucher
    const shopVoucherData = shopVouchers
      ? Object.entries(shopVouchers).map(([shopId, voucherId]) => {
          const shopItems = itemsByShop[shopId] || []
          const orderValue = shopItems.reduce((sum: number, item: any) => {
            const variant = variants.find((v: any) => v.id === item.productVariantId)
            return sum + (variant?.price || 0) * item.quantity
          }, 0)
          const items = shopItems.map((item: any) => {
            const variant = variants.find((v: any) => v.id === item.productVariantId)
            return { productId: item.productId, categoryId: variant?.categoryId }
          })
          return { voucherId, orderValue, items }
        })
      : []

    // Chuẩn bị data cho szone voucher (nếu có)
    let szoneVoucherData
    if (szoneVoucherId) {
      const allItems = Object.values(itemsByShop).flat() as any[]
      const totalOrderValue = allItems.reduce((sum: number, item: any) => {
        const variant = variants.find((v: any) => v.id === item.productVariantId)
        return sum + (variant?.price || 0) * item.quantity
      }, 0)
      const items = allItems.map((item: any) => {
        const variant = variants.find((v: any) => v.id === item.productVariantId)
        return { productId: item.productId, categoryId: variant?.categoryId }
      })
      szoneVoucherData = { voucherId: szoneVoucherId, orderValue: totalOrderValue, items }
    }

    return {
      sagaId,
      userId: saga.userId,
      shopVouchers: shopVoucherData,
      szoneVoucher: szoneVoucherData,
    }
  }

  buildCompensationPayload(sagaId: string, saga: Saga): Record<string, any> {
    const voucherIds = getUsedVoucherIds(saga.data.shopVouchers, saga.data.szoneVoucherId)
    return {
      sagaId,
      userId: saga.userId,
      voucherIds,
    }
  }
}
