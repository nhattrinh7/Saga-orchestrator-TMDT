import { Injectable } from '@nestjs/common'
import { PrismaService } from '~/infrastructure/database/prisma/prisma.service'
import { ISagaStepRepository } from '~/domain/repositories/saga-step.repository.interface'
import { SagaStepName, StepStatus } from '~/domain/enums/saga-step.enum'

@Injectable()
export class SagaStepRepository implements ISagaStepRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createStep(data: {
    sagaId: string
    stepName: SagaStepName
  }, tx?: any): Promise<string> {
    const client = tx || this.prisma
    const step = await client.sagaStep.create({
      data: {
        sagaId: data.sagaId,
        stepName: data.stepName,
        status: StepStatus.PROCESSING,
      },
    })
    return step.id
  }

  async updateStepStatus(stepId: string, status: StepStatus, data?: {
    result?: any
    error?: any
  }, tx?: any): Promise<void> {
    const client = tx || this.prisma
    await client.sagaStep.update({
      where: { id: stepId },
      data: {
        status,
        ...data,
      },
    })
  }

  async findStepByName(sagaId: string, stepName: SagaStepName): Promise<{
    id: string
    status: StepStatus
    result: any
  } | null> {
    const step = await this.prisma.sagaStep.findFirst({
      where: { sagaId, stepName },
      select: { id: true, status: true, result: true },
    })
    if (!step) return null
    return {
      id: step.id,
      status: step.status as StepStatus,
      result: step.result,
    }
  }

  async findCompletedSteps(sagaId: string): Promise<Array<{
    id: string
    stepName: SagaStepName
    status: StepStatus
    result: any
  }>> {
    const steps = await this.prisma.sagaStep.findMany({
      where: { sagaId, status: StepStatus.COMPLETED },
      orderBy: { createdAt: 'desc' },
      select: { id: true, stepName: true, status: true, result: true },
    })
    return steps.map(step => ({
      id: step.id,
      stepName: step.stepName as SagaStepName,
      status: step.status as StepStatus,
      result: step.result,
    }))
  }
}
