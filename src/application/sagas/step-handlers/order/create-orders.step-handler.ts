import { Injectable, Logger } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { ISagaStepHandler } from '~/domain/contracts/step-handler.interface'
import { SagaStepName } from '~/domain/enums/saga-step.enum'
import { Saga } from '~/domain/entities/saga.entity'
import { PaymentTimeoutService } from '~/infrastructure/queue/payment-timeout.service'

/**
 * CreateOrdersStepHandler
 *
 * Chuẩn bị data cho step CREATE_ORDERS:
 * - Lấy variants, address, priceCalculation, voucherResults từ các steps trước
 * - Build ordersData cho từng shop
 * - Gửi tới Order Service để tạo đơn hàng
 *
 * Compensation: cancel-orders (hủy các đơn đã tạo)
 *
 * Dùng ModuleRef thay vì forwardRef để tránh circular dependency proxy issue
 * forwardRef khiến NestJS tạo proxy object → class fields (stepName) không được init
 */
@Injectable()
export class CreateOrdersStepHandler implements ISagaStepHandler {
  readonly stepName = SagaStepName.CREATE_ORDERS

  constructor(private readonly moduleRef: ModuleRef) {}

  private readonly logger = new Logger(CreateOrdersStepHandler.name)

  buildPayload(
    sagaId: string,
    saga: Saga,
    previousResults: Map<SagaStepName, any>,
  ): Record<string, any> {
    const { itemsByShop, paymentMethod } = saga.data

    const variants = previousResults.get(SagaStepName.VALIDATE_ITEMS)?.variants || []
    const addressResult = previousResults.get(SagaStepName.GET_ADDRESS)
    const priceCalculation = previousResults.get(SagaStepName.CALCULATE_AND_VERIFY_PRICE) || {}
    const voucherResults = previousResults.get(SagaStepName.VALIDATE_VOUCHERS) || null
    const paymentResult = previousResults.get(SagaStepName.CREATE_PAYMENT)

    const address = addressResult?.address || {}
    const shippingAddress = `${address.detail}, ${address.ward}, ${address.province}`
    const paymentId = paymentResult?.paymentId

    const ordersData = this.buildOrdersData(
      itemsByShop,
      variants,
      voucherResults,
      priceCalculation,
      paymentMethod,
      paymentId,
      shippingAddress,
      address.recipientName,
      address.recipientPhoneNumber,
    )

    return {
      sagaId,
      userId: saga.userId,
      paymentMethod,
      paymentId,
      orders: ordersData,
    }
  }

  buildCompensationPayload(
    sagaId: string,
    saga: Saga,
    stepResult: any,
    _failureReason?: string,
  ): Record<string, any> {
    // Xác định cancel status:
    // - WALLET/QRCODE: nếu fail vì lý do thanh toán → PAYMENT_FAILED
    //   (ví dụ: sai passcode, hết số dư, timeout, payment webhook error)
    // - COD hoặc fail trước bước thanh toán → ORDER_FAILED
    const paymentMethod = saga.data?.paymentMethod
    const isPaymentRelated = paymentMethod === 'WALLET' || paymentMethod === 'QRCODE'
    const cancelStatus = isPaymentRelated ? 'PAYMENT_FAILED' : 'ORDER_FAILED'

    return {
      sagaId,
      orderIds: stepResult?.orderIds,
      status: cancelStatus,
    }
  }

  /**
   * Sau khi CREATE_ORDERS hoàn thành:
   * - WALLET/QRCODE: schedule payment timeout 15 phút
   * - COD: không cần (engine tự advance tiếp)
   */
  async afterComplete(sagaId: string, saga: Saga, _stepResult: any): Promise<void> {
    const paymentMethod = saga.data?.paymentMethod
    if (paymentMethod !== 'COD') {
      // Lazy resolve PaymentTimeoutService tại runtime (tránh circular dependency)
      const paymentTimeoutService = this.moduleRef.get(PaymentTimeoutService, { strict: false })
      await paymentTimeoutService.addPaymentTimeoutJob(sagaId, saga.userId)
    }
    this.logger.log(`addPaymentTimeoutJob thành công, sagaId=${sagaId}`)
  }

  // ==================== Private helpers ====================

  private buildOrdersData(
    itemsByShop: Record<string, any[]>,
    variants: any[],
    _voucherResults: any,
    priceCalculation: any,
    paymentMethod: string,
    paymentId: string | undefined,
    shippingAddress: string,
    receiverName: string,
    receiverPhoneNumber: string,
  ) {
    return priceCalculation.shopBreakdowns.map((shopBreakdown: any) => {
      const shopItems = itemsByShop[shopBreakdown.shopId]
      const items = shopItems.map((item: any) => {
        const variant = variants.find((v: any) => v.id === item.productVariantId)
        return {
          productId: item.productId,
          productVariantId: item.productVariantId,
          quantity: item.quantity,
          price: variant?.price || 0,
          productName: variant?.productName || '',
          sku: variant?.sku || '',
          image: variant?.image || '',
        }
      })

      return {
        shopId: shopBreakdown.shopId,
        subtotal: shopBreakdown.subtotal,
        shippingFee: shopBreakdown.shippingFee,
        shopVoucherDiscount: shopBreakdown.shopVoucherDiscount,
        szoneVoucherDiscount: shopBreakdown.szoneVoucherDiscount,
        goodsPrice: shopBreakdown.goodsPrice,
        finalPrice: shopBreakdown.finalPrice,
        paymentMethod,
        paymentId,
        shippingAddress,
        receiverName,
        receiverPhoneNumber,
        items,
      }
    })
  }
}
