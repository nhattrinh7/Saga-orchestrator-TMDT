import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject, HttpException, HttpStatus } from '@nestjs/common'
import { PlaceOrderCommand } from './place-order.command'
import { PlaceOrderResponseDto } from '~/presentation/dtos/place-order.dto'
import { type ISagaRepository, SAGA_REPOSITORY } from '~/domain/repositories/saga.repository.interface'
import { SagaEngine } from '~/application/sagas/saga-engine.service'
import { SAGATYPE } from '~/common/constants/saga.constant'

/**
 * PlaceOrderHandler - Entry point cho saga đặt hàng
 *
 * Flow: Tạo saga → gọi SagaEngine.startSaga() → Engine tự đọc definition
 * và kích hoạt các steps đầu tiên → return sagaId ngay lập tức
 */
@CommandHandler(PlaceOrderCommand)
export class PlaceOrderHandler implements ICommandHandler<PlaceOrderCommand> {
  constructor(
    @Inject(SAGA_REPOSITORY) private readonly sagaRepo: ISagaRepository,
    private readonly sagaEngine: SagaEngine,
  ) {}

  async execute(command: PlaceOrderCommand): Promise<PlaceOrderResponseDto> {
    const { data, userId } = command
    const { paymentMethod } = data

    // 1. Tạo saga
    const saga = await this.sagaRepo.createSaga({
      userId,
      sagaType: SAGATYPE.ORDER_SAGA,
      data: { ...data },
    })

    try {
      // 2. Engine tự đọc definition, kích hoạt các steps đầu tiên (PARALLEL hoặc SEQUENTIAL)
      await this.sagaEngine.startSaga(saga.id)

      // 3. Return sagaId ngay lập tức (async processing qua events)
      return {
        success: true,
        sagaId: saga.id,
        message: 'Đơn hàng đang được xử lý',
        paymentMethod,
      }
    } catch (error: any) {
      console.error(`❌ Saga ${saga.id} failed to start:`, error.message)
      throw new HttpException(
        { success: false, sagaId: saga.id, error: error.message },
        HttpStatus.BAD_REQUEST,
      )
    }
  }
}
