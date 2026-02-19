import { AggregateRoot } from '@nestjs/cqrs'
import { v4 as uuidv4 } from 'uuid'
import { SagaType } from '~/domain/enums/saga.enum'

export class Saga extends AggregateRoot {
  constructor(
    
  ) {
    super()
  }
} 