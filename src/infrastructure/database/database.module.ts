import { Module } from '@nestjs/common'
import { PrismaService } from '~/infrastructure/database/prisma/prisma.service'
import { SAGA_REPOSITORY } from '~/domain/repositories/saga.repository.interface'
import { SagaRepository } from '~/infrastructure/database/repositories/saga.repository'
import { CqrsModule } from '@nestjs/cqrs'

@Module({
  imports: [CqrsModule],
  providers: [
    PrismaService,
    {
      provide: SAGA_REPOSITORY,
      useClass: SagaRepository,
    },
    
  ],
  exports: [
    SAGA_REPOSITORY,
  ],
})
export class DatabaseModule {}
