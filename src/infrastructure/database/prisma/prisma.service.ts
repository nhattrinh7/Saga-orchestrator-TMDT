import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { PrismaClient, Prisma } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    } as Prisma.PrismaClientOptions)
  }

  async onModuleInit() {
    try {
      await this.$connect()
      this.logger.log('Database connected successfully')
    } catch (error) {
      this.logger.error('Failed to connect to database', error)
      throw error
    }
  }

  async transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(fn, {
      maxWait: 10000,  // 10s chờ lấy connection từ pool
      timeout: 15000,  // 15s cho transaction hoàn thành
    })
  }

  async onModuleDestroy() {
    await this.$disconnect()
    this.logger.log('Database disconnected')
  }
}
