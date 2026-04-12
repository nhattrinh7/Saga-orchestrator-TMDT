import { Controller } from '@nestjs/common'
import { Payload, Ctx, RmqContext, EventPattern } from '@nestjs/microservices'
import { SagaEngine } from '~/application/sagas/saga-engine.service'
import { SagaStepName } from '~/domain/enums/saga-step.enum'
import { BaseRetryConsumer } from '~/common/utils/base-retry.consumer'

/**
 * SagaStepResultConsumer - Nhận result events từ tất cả services.
 *
 * Pattern: saga.result.{stepName}
 * Mỗi service consumer xử lý xong sẽ emit result event chứa { sagaId, success, ...data }
 *
 * Consumer này forward tới SagaEngine để advance saga.
 * Logic xử lý chung nằm ở handleResult(), mỗi @EventPattern chỉ là wrapper mỏng.
 */
@Controller()
export class SagaStepResultConsumer extends BaseRetryConsumer {
  constructor(private readonly sagaEngine: SagaEngine) {
    super()
  }

  // ==================== Event Handlers ====================

  @EventPattern('saga.result.validate-items')
  async onValidateItems(@Payload() data: any, @Ctx() ctx: RmqContext) {
    await this.handleResult(SagaStepName.VALIDATE_ITEMS, data, ctx)
  }

  @EventPattern('saga.result.get-address')
  async onGetAddress(@Payload() data: any, @Ctx() ctx: RmqContext) {
    await this.handleResult(SagaStepName.GET_ADDRESS, data, ctx)
  }

  @EventPattern('saga.result.validate-vouchers')
  async onValidateVouchers(@Payload() data: any, @Ctx() ctx: RmqContext) {
    await this.handleResult(SagaStepName.VALIDATE_VOUCHERS, data, ctx)
  }

  @EventPattern('saga.result.reserve-inventory')
  async onReserveInventory(@Payload() data: any, @Ctx() ctx: RmqContext) {
    await this.handleResult(SagaStepName.RESERVE_INVENTORY, data, ctx)
  }

  @EventPattern('saga.result.create-payment')
  async onCreatePayment(@Payload() data: any, @Ctx() ctx: RmqContext) {
    await this.handleResult(SagaStepName.CREATE_PAYMENT, data, ctx)
  }

  @EventPattern('saga.result.create-orders')
  async onCreateOrders(@Payload() data: any, @Ctx() ctx: RmqContext) {
    await this.handleResult(SagaStepName.CREATE_ORDERS, data, ctx)
  }

  @EventPattern('saga.result.confirm-vouchers')
  async onConfirmVouchers(@Payload() data: any, @Ctx() ctx: RmqContext) {
    await this.handleResult(SagaStepName.CONFIRM_VOUCHERS, data, ctx)
  }

  @EventPattern('saga.result.remove-cart-items')
  async onRemoveCartItems(@Payload() data: any, @Ctx() ctx: RmqContext) {
    await this.handleResult(SagaStepName.REMOVE_CART_ITEMS, data, ctx)
  }

  @EventPattern('saga.result.increase-buy-count')
  async onIncreaseBuyCount(@Payload() data: any, @Ctx() ctx: RmqContext) {
    await this.handleResult(SagaStepName.INCREASE_BUY_COUNT, data, ctx)
  }

  @EventPattern('saga.result.verify-passcode-and-deduct')
  async onWalletPayment(@Payload() data: any, @Ctx() ctx: RmqContext) {
    await this.handleResult(SagaStepName.PROCESS_WALLET_PAYMENT, data, ctx)
  }

  // ==================== Common Handler ====================

  /**
   * Xử lý chung cho tất cả step results.
   * Mỗi @EventPattern chỉ gọi method này với stepName tương ứng.
   */
  private async handleResult(stepName: SagaStepName, data: any, ctx: RmqContext): Promise<void> {
    await this.handleWithRetry(ctx, async () => {
      await this.sagaEngine.handleStepResult(data.sagaId, stepName, data)
    })
  }
}
