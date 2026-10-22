import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common'
import { WordAudioService } from './word-audio.service.js'

@Controller('speech')
export class SpeechController {
  constructor(private readonly wordAudioService: WordAudioService) {}

  @Get(':wordId')
  @Header('Cache-Control', 'private, max-age=31536000, immutable')
  async getWordAudio(
    @Param('wordId', ParseUUIDPipe) wordId: string,
  ): Promise<StreamableFile> {
    const mp3 = await this.wordAudioService.getAudioMp3(wordId)
    return new StreamableFile(mp3, {
      type: 'audio/mpeg',
      disposition: 'inline',
    })
  }
}
