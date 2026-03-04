import {
  Body,
  Controller,
  Post,
  Headers,
} from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import type{ PlaceOrderRequestDto, ConfirmWalletPaymentRequestDto } from '~/presentation/dtos/place-order.dto'
import { PlaceOrderCommand } from '~/application/commands/place-order/place-order.command'
import { ConfirmWalletPaymentCommand } from '~/application/commands/confirm-wallet-payment/confirm-wallet-payment.command'

@Controller('v1/sagas')
export class SagaController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}


  @Post('place-order')
  async placeOrder(
    @Body() body: PlaceOrderRequestDto,
    @Headers('x-user-id') userId: string,
  ) {
    const result = await this.commandBus.execute(
      new PlaceOrderCommand(body, userId)
    )
    return result
  }

  @Post('confirm-wallet-payment')
  async confirmWalletPayment(
    @Body() body: ConfirmWalletPaymentRequestDto,
    @Headers('x-user-id') userId: string,
  ) {
    const result = await this.commandBus.execute(
      new ConfirmWalletPaymentCommand(body, userId)
    )
    return result
  }
}
