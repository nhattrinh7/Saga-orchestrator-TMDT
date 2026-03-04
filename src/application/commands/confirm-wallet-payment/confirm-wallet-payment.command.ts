import { ConfirmWalletPaymentRequestDto } from '~/presentation/dtos/place-order.dto'

export class ConfirmWalletPaymentCommand {
  constructor(
    public readonly data: ConfirmWalletPaymentRequestDto,
    public readonly userId: string,
  ) {}
}
