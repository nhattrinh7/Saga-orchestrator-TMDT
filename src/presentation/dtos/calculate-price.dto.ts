import { createZodDto } from 'nestjs-zod'
import z from 'zod'

// Request DTO Schema
export const CalculatePriceRequestSchema = z.object({
  itemsByShop: z.record(
    z.string(), // shopId
    z.array(
      z.object({
        productId: z.uuid(),
        productVariantId: z.uuid(),
        quantity: z.number().int().positive(),
      })
    )
  ),
  szoneVoucherId: z.uuid().optional(),
  shopVouchers: z.record(
    z.string(), // shopId
    z.uuid() // voucherId
  ).optional(),
})

export class CalculatePriceRequestDto extends createZodDto(CalculatePriceRequestSchema) {}

// Response DTOs
export interface ItemDto {
  id: string
  productId: string
  productVariantId: string
  name: string
  price: number
  quantity: number
  image: string
  sku: string
}

export interface ShopItemsDto {
  id: string
  name: string
  logo: string
  shopSubtotal: number
  shopShippingFee: number
  shopVoucherDiscount: number
  items: ItemDto[]
}

export interface SummaryDto {
  subtotal: number
  shippingFee: number
  shopsVoucherDiscount: number
  szoneVoucherDiscount: number
  finalPrice: number
}

export interface CalculatePriceResponseDto {
  success: boolean
  data: {
    itemsWithShop: ShopItemsDto[]
    summary: SummaryDto
  }
}
