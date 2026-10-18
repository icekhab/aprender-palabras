import { Module } from '@nestjs/common'
import { UnsplashService } from './unsplash.service.js'

@Module({
  providers: [UnsplashService],
  exports: [UnsplashService],
})
export class UnsplashModule {}
