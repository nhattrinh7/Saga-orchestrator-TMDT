/**
 * Gom danh sách voucher IDs đã dùng (shop vouchers + szone voucher).
 * Dùng chung cho ValidateVouchersStepHandler, ConfirmVouchersStepHandler và SagaEngine.
 */
export function getUsedVoucherIds(
  shopVouchers?: Record<string, string>,
  szoneVoucherId?: string,
): string[] {
  const ids: string[] = []
  if (shopVouchers) ids.push(...Object.values(shopVouchers))
  if (szoneVoucherId) ids.push(szoneVoucherId)
  return ids
}
