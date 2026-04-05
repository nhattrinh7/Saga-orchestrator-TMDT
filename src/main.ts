import { GlobalExceptionFilter } from './common/filters/global-exception.filter'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { Transport, MicroserviceOptions } from '@nestjs/microservices'
import { ConfigService } from '@nestjs/config'
import { setConfigService } from '~/configs/env.config'
import { ResponseInterceptor } from '~/common/interceptors/response.interceptor'
import { env } from '~/configs/env.config'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.setGlobalPrefix('api')
  app.useGlobalFilters(new GlobalExceptionFilter())
  app.useGlobalInterceptors(new ResponseInterceptor())

  const configService = app.get(ConfigService)
  setConfigService(configService)

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [`amqp://admin:admin123@${process.env.RABBITMQ_HOST || 'localhost'}:5672`], // lên production thì sửa localhost thành rabbitmq-service
      exchange: 'events_exchange',
      exchangeType: 'topic',
      wildcards: true,
      queue: 'saga_queue',
      consumerTag: 'saga_consumer',
      queueOptions: {
        durable: true, // queue được persist để ko mất khi restart
        exclusive: false, // nhiều consumer có thể consume queue này
        autoDelete: false, // queue không bị xóa khi không có consumer
      },
      noAck: false,
      prefetchCount: 10,
    },
  })

  await app.startAllMicroservices()

  await app.listen(env.config.PORT ?? 3012)
}

// eslint-disable-next-line no-console
bootstrap().catch(console.error)
