import { PlaceOrderRequestDto } from '~/presentation/dtos/place-order.dto'

export class PlaceOrderCommand {
  constructor(
    public readonly data: PlaceOrderRequestDto,
    public readonly userId: string,
  ) {}
}
