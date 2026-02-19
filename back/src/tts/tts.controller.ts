import { Controller, Get, Header, HttpException, HttpStatus, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { TtsService } from './tts.service';

@Controller('tts')
export class TtsController {
  constructor(private readonly tts: TtsService) {}

  @Get('voices')
  async voices() {
    // macOS only for now
    return await this.tts.listMacVoices();
  }

  @Get()
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
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
      const buf = await this.tts.synthMacM4a({ text: t, voice });
      res.setHeader('Content-Type', 'audio/mp4');
      res.send(buf);
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? 'TTS failed');
      // Not implemented / missing tools on non-mac platforms
      if (msg.toLowerCase().includes('only implemented for macos')) {
        throw new HttpException(msg, HttpStatus.NOT_IMPLEMENTED);
      }
      throw new HttpException(msg, HttpStatus.BAD_REQUEST);
    }
  }
}

