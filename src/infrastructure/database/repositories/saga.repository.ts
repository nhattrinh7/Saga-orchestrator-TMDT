import { Injectable } from '@nestjs/common'
import { PrismaService } from '~/infrastructure/database/prisma/prisma.service'
import { Saga } from '~/domain/entities/saga.entity'
import { ISagaRepository } from '~/domain/repositories/saga.repository.interface'

@Injectable()
export class SagaRepository implements ISagaRepository {
  constructor(private readonly prisma: PrismaService) {}

  
}
  