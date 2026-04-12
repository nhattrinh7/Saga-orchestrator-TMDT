import { SagaStepName, StepStatus } from '~/domain/enums/saga-step.enum'

export interface ISagaStepRepository {
  createStep(
    data: {
      sagaId: string
      stepName: SagaStepName
    },
    tx?: any,
  ): Promise<string>

  updateStepStatus(
    stepId: string,
    status: StepStatus,
    data?: {
      result?: any
      error?: any
    },
    tx?: any,
  ): Promise<void>

  findStepByName(
    sagaId: string,
    stepName: SagaStepName,
  ): Promise<{
    id: string
    status: StepStatus
    result: any
  } | null>

  findCompletedSteps(sagaId: string): Promise<
    Array<{
      id: string
      stepName: SagaStepName
      status: StepStatus
      result: any
    }>
  >
}

export const SAGA_STEP_REPOSITORY = Symbol('ISagaStepRepository')
