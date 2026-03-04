import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import Joi from 'joi'
import { ZodValidationPipe } from 'nestjs-zod'
import { APP_PIPE } from '@nestjs/core'
import { PresentationModule } from '~/presentation/presentation.module'
import { ApplicationModule } from '~/application/application.module'
import { InfrastructureModule } from '~/infrastructure/infrastructure.module'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { BullModule } from '@nestjs/bullmq'
import { RequestLoggingMiddleware } from '~/common/middleware/request-logging.middleware'

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',  
        ttl: 1000,          
        limit: 100,          
      },
      {
        name: 'long',
        ttl: 60000,       
        limit: 500,
      }
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
      }),
      validationOptions: {
        abortEarly: true, // Show 1 errors per times
      },
    }),
    BullModule.forRoot({
      connection: {
        host: 'localhost', // localhost:6379 là địa chỉ của redis
        port: 6379,
      },
    }),
    InfrastructureModule,
    ApplicationModule,
    PresentationModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes('{*path}')
  }
}
