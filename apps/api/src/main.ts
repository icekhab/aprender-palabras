import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.use(cookieParser())
  app.setGlobalPrefix('api')
  app.enableShutdownHooks()
  // Railway private network is IPv6-only; listening on :: accepts it.
  await app.listen(process.env.PORT ?? 3000, '::')
}
await bootstrap()
