import { SagaStepName, StepStatus } from '~/domain/enums/saga-step.enum'

export class SagaStep {
  id: string
  sagaId: string
  stepName: SagaStepName
  status: StepStatus
  result: any
  error: any
  createdAt: Date
  updatedAt: Date

  constructor(partial: Partial<SagaStep>) {
    Object.assign(this, partial)
  }
}
