import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Headers,
} from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { CalculatePriceRequestDto } from '~/presentation/dtos/calculate-price.dto'
import { CalculatePriceCommand } from '~/application/commands/calculate-price/calculate-price.command'

@Controller('v1/orders')
export class OrderController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // @Get(':id/shipper')
  // async getOrderToShipper(
  //   @Param('id') orderId: string,
  //   @Body() body: { name: string; phoneNumber: string },
  // ) {
  //   const result = await this.queryBus.execute(new GetOrderToShipperQuery(orderId, body))

  //   return { message: 'Get order to shipper successful', data: result }
  // }

  @Post('calculate-price')
  async calculatePrice(
    @Body() body: CalculatePriceRequestDto,
    @Headers('x-user-id') userId: string,
  ) {
    console.log('userId', userId)
    const result = await this.commandBus.execute(
      new CalculatePriceCommand(
        body.itemsByShop,
        userId,
        body.szoneVoucherId,
        body.shopVouchers
      )
    )

    return result
  }
}
