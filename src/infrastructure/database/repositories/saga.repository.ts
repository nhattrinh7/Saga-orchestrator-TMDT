import { Injectable } from '@nestjs/common'
import { PrismaService } from '~/infrastructure/database/prisma/prisma.service'
import { Saga } from '~/domain/entities/saga.entity'
import { SagaStep } from '~/domain/entities/saga-step.entity'
import { ISagaRepository } from '~/domain/repositories/saga.repository.interface'
import { SagaStatus } from '~/domain/enums/saga.enum'
import { SagaStepName, StepStatus } from '~/domain/enums/saga-step.enum'

@Injectable()
export class SagaRepository implements ISagaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSaga(
    data: {
      userId: string
      sagaType: string
      data: any
    },
    tx?: any,
  ): Promise<Saga> {
    const client = tx || this.prisma
    const saga = await client.saga.create({
      data: {
        userId: data.userId,
        sagaType: data.sagaType,
        data: data.data,
        status: 'STARTED',
      },
      include: { steps: true },
    })

    return new Saga({
      ...saga,
      status: saga.status as SagaStatus,
      steps: saga.steps.map(
        step =>
          new SagaStep({
            ...step,
            status: step.status as StepStatus,
            stepName: step.stepName as SagaStepName,
          }),
      ),
    })
  }

  async findById(id: string): Promise<Saga | null> {
    const saga = await this.prisma.saga.findUnique({
      where: { id },
      include: { steps: true },
    })

    if (!saga) return null

    return new Saga({
      ...saga,
      status: saga.status as SagaStatus,
      steps: saga.steps.map(
        step =>
          new SagaStep({
            ...step,
            status: step.status as StepStatus,
            stepName: step.stepName as SagaStepName,
          }),
      ),
    })
  }

  async updateSagaStatus(
    sagaId: string,
    status: SagaStatus,
    extras?: {
      currentStep?: string | null
      failureReason?: string
      completedAt?: Date
      compensatedAt?: Date
    },
    tx?: any,
  ): Promise<void> {
    const client = tx || this.prisma
    await client.saga.update({
      where: { id: sagaId },
      data: {
        status,
        ...extras,
      },
    })
  }
}
