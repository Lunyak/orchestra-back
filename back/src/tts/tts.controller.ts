import { Controller, Get, HttpException, HttpStatus, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { TtsService } from './tts.service';

@Controller('tts')
export class TtsController {
  constructor(private readonly tts: TtsService) {}

  @Get('voices')
  async voices() {
    return await this.tts.listVoices();
  }

  @Get()
  async speak(
    @Query('text') text: string,
    @Query('voice') voice: string | undefined,
    @Res() res: Response,
  ) {
    const t = String(text ?? '').trim();
    if (!t) {
      throw new HttpException('Missing text', HttpStatus.BAD_REQUEST);
    }
    try {
      const out = await this.tts.synth({ text: t, voice });
      res.setHeader('Content-Type', out.mime);
      // Cache only successful audio responses. Don't mark as immutable (errors got cached by browsers).
      res.setHeader('Cache-Control', 'public, max-age=604800');
      res.send(out.buf);
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? 'TTS failed');
      throw new HttpException(msg, HttpStatus.BAD_REQUEST);
    }
  }
}

