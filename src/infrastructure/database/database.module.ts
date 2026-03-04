import { Module } from '@nestjs/common'
import { PrismaService } from '~/infrastructure/database/prisma/prisma.service'
import { SAGA_REPOSITORY } from '~/domain/repositories/saga.repository.interface'
import { SagaRepository } from '~/infrastructure/database/repositories/saga.repository'
import { SAGA_STEP_REPOSITORY } from '~/domain/repositories/saga-step.repository.interface'
import { SagaStepRepository } from '~/infrastructure/database/repositories/saga-step.repository'
import { CqrsModule } from '@nestjs/cqrs'

@Module({
  imports: [CqrsModule],
  providers: [
    PrismaService,
    {
      provide: SAGA_REPOSITORY,
      useClass: SagaRepository,
    },
    {
      provide: SAGA_STEP_REPOSITORY,
      useClass: SagaStepRepository,
    },
  ],
  exports: [
    PrismaService,
    SAGA_REPOSITORY,
    SAGA_STEP_REPOSITORY,
  ],
})
export class DatabaseModule {}
