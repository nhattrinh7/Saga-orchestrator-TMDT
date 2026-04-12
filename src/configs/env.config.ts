import { ConfigService } from '@nestjs/config'

class EnvConfig {
  constructor(private configService: ConfigService) {}

  get config() {
    return {
      DATABASE_URL: this.configService.get<string>('DATABASE_URL')!,
      SERVICE_NAME: this.configService.get<string>('SERVICE_NAME'),
      SERVICE_HOST: this.configService.get<string>('SERVICE_HOST'),
      PORT: this.configService.get<string>('PORT'),
    }
  }
}

let envInstance: EnvConfig

export const setConfigService = (configService: ConfigService) => {
  envInstance = new EnvConfig(configService)
}

export const env = new Proxy({} as EnvConfig, {
  get(_, prop) {
    if (!envInstance) {
      throw new Error(
        '❌ EnvConfig not initialized! Call setConfigService() in AppModule constructor or main.ts',
      )
    }
    return envInstance[prop as keyof EnvConfig]
  },
})
