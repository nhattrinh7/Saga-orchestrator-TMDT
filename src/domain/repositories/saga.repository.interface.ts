import { Saga } from '~/domain/entities/saga.entity'
import { SagaStatus } from '~/domain/enums/saga.enum'

export interface ISagaRepository {
  createSaga(data: {
    userId: string
    sagaType: string
    data: any
  }, tx?: any): Promise<Saga>

  findById(id: string): Promise<Saga | null>

  updateSagaStatus(sagaId: string, status: SagaStatus, extras?: {
    currentStep?: string | null
    failureReason?: string
    completedAt?: Date
    compensatedAt?: Date
  }, tx?: any): Promise<void>
}

export const SAGA_REPOSITORY = Symbol('ISagaRepository')
