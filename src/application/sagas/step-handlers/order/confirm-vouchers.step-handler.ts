import { Injectable } from '@nestjs/common'
import { ISagaStepHandler } from '~/domain/contracts/step-handler.interface'
import { SagaStepName } from '~/domain/enums/saga-step.enum'
import { Saga } from '~/domain/entities/saga.entity'
import { getUsedVoucherIds } from '~/common/utils/get-used-voucher-ids.util'

/**
 * ConfirmVouchersStepHandler
 *
 * Chuẩn bị data cho step CONFIRM_VOUCHERS:
 * - Gom danh sách voucher IDs (shop + szone)
 * - Gửi tới Voucher Service để confirm (trừ usage)
 *
 * Compensation: cancel-vouchers (hoàn lại voucher đã confirm)
 */
@Injectable()
export class ConfirmVouchersStepHandler implements ISagaStepHandler {
  readonly stepName = SagaStepName.CONFIRM_VOUCHERS

  buildPayload(sagaId: string, saga: Saga): Record<string, any> {
    const voucherIds = getUsedVoucherIds(saga.data.shopVouchers, saga.data.szoneVoucherId)
    return {
      sagaId,
      userId: saga.userId,
      voucherIds,
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
