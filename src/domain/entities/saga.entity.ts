import { AggregateRoot } from '@nestjs/cqrs'
import { SagaStatus } from '~/domain/enums/saga.enum'
import { SagaStep } from '~/domain/entities/saga-step.entity'

export class Saga extends AggregateRoot {
  id: string
  userId: string
  sagaType: string
  status: SagaStatus
  currentStep: string | null
  data: any
  failureReason: string | null
  createdAt: Date
  completedAt: Date | null
  compensatedAt: Date | null
  steps: SagaStep[]

  constructor(partial: Partial<Saga>) {
    super()
    Object.assign(this, partial)
  }
}
