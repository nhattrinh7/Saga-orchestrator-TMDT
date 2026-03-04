export interface PlaceOrderRequestDto {
  itemsByShop: Record<string, Array<{
    productId: string
    productVariantId: string
    quantity: number
  }>>
  shopVouchers?: Record<string, string>
  szoneVoucherId?: string
  expectedFinalPrice: number
  addressId: string
  paymentMethod: 'COD' | 'WALLET' | 'QRCODE'
}

export interface PlaceOrderResponseDto {
  success: boolean
  sagaId: string
  message?: string
  paymentMethod?: string
  error?: string
}

export interface ConfirmWalletPaymentRequestDto {
  sagaId: string
  passcode: string
}

export interface ConfirmWalletPaymentResponseDto {
  success: boolean
  message?: string
  error?: string
}
