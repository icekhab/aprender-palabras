import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { AuthGuard } from './auth/auth.guard.js'
import { AuthModule } from './auth/auth.module.js'
import { OriginGuard } from './auth/origin.guard.js'
import { HealthController } from './health.controller.js'
import { LessonsModule } from './lessons/lessons.module.js'
import { PrismaModule } from './prisma.module.js'
import { SuggestionsModule } from './suggestions/suggestions.module.js'
import { TrainingModule } from './training/training.module.js'
import { WordsModule } from './words/words.module.js'

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    SuggestionsModule,
    WordsModule,
    LessonsModule,
    TrainingModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OriginGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
