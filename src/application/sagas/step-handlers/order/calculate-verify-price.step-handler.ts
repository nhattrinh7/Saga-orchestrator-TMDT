import { Injectable } from '@nestjs/common'
import { ISagaStepHandler } from '~/domain/contracts/step-handler.interface'
import { SagaStepName } from '~/domain/enums/saga-step.enum'
import { Saga } from '~/domain/entities/saga.entity'
import { SHIPPING_FEE_PER_SHOP } from '~/common/constants/constant'

type ShopBreakdown = {
  shopId: string
  subtotal: number
  shippingFee: number
  shopVoucherDiscount: number
  szoneVoucherDiscount: number
  goodsPrice: number
  finalPrice: number
}

type PriceCalculationResult = {
  totalSubtotal: number
  totalShippingFee: number
  totalShopVoucherDiscount: number
  szoneVoucherDiscount: number
  goodsPrice: number
  finalPrice: number
  shopBreakdowns: ShopBreakdown[]
}

/**
 * CalculateVerifyPriceStepHandler
 *
 * Step LOCAL — tính giá ngay tại orchestrator, không emit event.
 *
 * Logic:
 * 1. Tính subtotal cho từng shop (dựa vào variants)
 * 2. Áp dụng shop voucher discount + szone voucher discount
 * 3. Cộng phí ship
 * 4. So sánh finalPrice với expectedFinalPrice từ FE
 * 5. Nếu giá không khớp → throw error (engine sẽ compensate)
 *
 * Step này không cần compensation (chỉ tính toán, không tạo side-effect)
 */
@Injectable()
export class CalculateVerifyPriceStepHandler implements ISagaStepHandler {
  readonly stepName = SagaStepName.CALCULATE_AND_VERIFY_PRICE

  // Không dùng cho local step, nhưng interface yêu cầu
  buildPayload(): Record<string, any> {
    return {}
  }

  buildCompensationPayload(): null {
    return null
  }

  /**
   * Tính giá locally và verify với giá FE gửi lên.
   * Throw error nếu giá không khớp → engine tự compensate.
   */
  executeLocal(
    _sagaId: string,
    saga: Saga,
    previousResults: Map<SagaStepName, any>,
  ): PriceCalculationResult {
    const { itemsByShop, expectedFinalPrice } = saga.data
    const variants = previousResults.get(SagaStepName.VALIDATE_ITEMS)?.variants || []
    const voucherResults = previousResults.get(SagaStepName.VALIDATE_VOUCHERS) || null

    const priceCalculation = this.calculatePrice(itemsByShop, variants, voucherResults)

    // Verify giá với FE
    if (Math.abs(priceCalculation.finalPrice - expectedFinalPrice) > 0.01) {
      throw new Error(
        `Giá không khớp: expected ${expectedFinalPrice}, got ${priceCalculation.finalPrice}`,
      )
    }

    return priceCalculation
  }

  // ==================== Private helpers ====================

  private calculatePrice(
    itemsByShop: Record<string, any[]>,
    variants: any[],
    voucherResults: any,
  ): PriceCalculationResult {
    const shopEntries = Object.entries(itemsByShop)
    let totalSubtotal = 0
    let totalShippingFee = 0
    let totalShopVoucherDiscount = 0
    let szoneVoucherDiscount = 0

    const shopBreakdowns: Array<{
      shopId: string
      subtotal: number
      shippingFee: number
      shopVoucherDiscount: number
      szoneVoucherDiscount: number
      goodsPrice: number
      finalPrice: number
    }> = []

    for (const [shopId, items] of shopEntries) {
      const subtotal = items.reduce((sum, item) => {
        const variant = variants.find((v: any) => v.id === item.productVariantId)
        return sum + (variant?.price || 0) * item.quantity
      }, 0)

      const shippingFee = SHIPPING_FEE_PER_SHOP
      totalSubtotal += subtotal
      totalShippingFee += shippingFee

      // Áp dụng shop voucher discount
      let shopDiscount = 0
      if (voucherResults?.shopVoucherResults) {
        const shopVoucherResult = voucherResults.shopVoucherResults.find(
          (v: any) => v.shopId === shopId,
        )
        if (shopVoucherResult) {
          shopDiscount = shopVoucherResult.discount || 0
        }
      }
      totalShopVoucherDiscount += shopDiscount

      shopBreakdowns.push({
        shopId,
        subtotal,
        shippingFee,
        shopVoucherDiscount: shopDiscount,
        szoneVoucherDiscount: 0,
        goodsPrice: 0,
        finalPrice: 0,
      })
    }

    // Áp dụng szone voucher discount
    if (voucherResults?.szoneVoucherResult) {
      szoneVoucherDiscount = voucherResults.szoneVoucherResult.discount || 0
    }

    // Phân bổ szone discount theo tỷ lệ subtotal từng shop
    if (szoneVoucherDiscount > 0 && shopBreakdowns.length > 0) {
      let allocated = 0
      for (let i = 0; i < shopBreakdowns.length; i++) {
        if (i === shopBreakdowns.length - 1) {
          shopBreakdowns[i].szoneVoucherDiscount = szoneVoucherDiscount - allocated
        } else {
          const ratio = shopBreakdowns[i].subtotal / totalSubtotal
          const discount = Math.floor(szoneVoucherDiscount * ratio)
          shopBreakdowns[i].szoneVoucherDiscount = discount
          allocated += discount
        }
      }
    }

    for (const shop of shopBreakdowns) {
      shop.goodsPrice = shop.subtotal - shop.shopVoucherDiscount - shop.szoneVoucherDiscount
      shop.finalPrice =
        shop.subtotal + shop.shippingFee - shop.shopVoucherDiscount - shop.szoneVoucherDiscount
    }

    const finalPrice =
      totalSubtotal + totalShippingFee - totalShopVoucherDiscount - szoneVoucherDiscount
    const goodsPrice = totalSubtotal - totalShopVoucherDiscount - szoneVoucherDiscount

    return {
      totalSubtotal,
      totalShippingFee,
      totalShopVoucherDiscount,
      szoneVoucherDiscount,
      goodsPrice,
      finalPrice,
      shopBreakdowns,
    }
  }
}
