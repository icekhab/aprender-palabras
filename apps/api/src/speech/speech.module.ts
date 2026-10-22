import { Module } from '@nestjs/common'
import { ElevenLabsModule } from '../integrations/elevenlabs/elevenlabs.module.js'
import { SpeechController } from './speech.controller.js'
import { WordAudioService } from './word-audio.service.js'

@Module({
  imports: [ElevenLabsModule],
  controllers: [SpeechController],
  providers: [WordAudioService],
  exports: [WordAudioService],
})
export class SpeechModule {}
