import { defineConfig, env } from 'prisma/config'
import { config } from 'dotenv'

const envPath =
  process.env.DOTENV_CONFIG_PATH ??
  (process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development')

config({ path: envPath })

export default defineConfig({
  schema: 'src/infrastructure/database/prisma/schema.prisma',
  migrations: {
    path: 'src/infrastructure/database/prisma/migrations',
  },
  engine: 'classic',
  datasource: {
    url: env('DATABASE_URL'),
  },
})

