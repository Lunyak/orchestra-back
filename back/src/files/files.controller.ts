import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsIn, IsString } from 'class-validator';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileStorageService } from './file-storage.service';
import { LocalFileStorageService } from './local-file-storage.service';

export class UploadFileDto {
  @IsString()
  projectId: string;

  @IsString()
  @IsIn(['playlist', 'image', 'sound', 'model'])
  type: 'playlist' | 'image' | 'sound' | 'model';
}

@Controller('files')
export class FilesController {
  constructor(
    private readonly config: ConfigService,
    private readonly storage: FileStorageService,
    private readonly localStorage: LocalFileStorageService,
  ) {}

  private useLocalStorage(): boolean {
    return this.config.get<string>('STORAGE_TYPE') === 'local';
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        // Защита от случайной загрузки огромных файлов в память
        fileSize: 100 * 1024 * 1024, // 100MB
      },
    }),
  )
  async upload(
    // Тип Multer в @types/express@5 отсутствует, поэтому используем any
    @UploadedFile() file: any,
    @Body() body: UploadFileDto,
    @Query() query: Partial<UploadFileDto>,
  ) {
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }

    const projectId = body?.projectId ?? query?.projectId;
    const type = body?.type ?? query?.type;
    if (!projectId || !type) {
      throw new BadRequestException('projectId и type обязательны');
    }
    if (typeof projectId !== 'string' || typeof type !== 'string') {
      throw new BadRequestException('projectId и type должны быть строками');
    }
    if (!file?.buffer) {
      throw new BadRequestException(
        'Файл получен без buffer (ожидается multipart/form-data)',
      );
    }

    const storage = this.useLocalStorage() ? this.localStorage : this.storage;
    const result = await storage.uploadObject({
      projectId,
      type,
      fileName: file.originalname,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    return {
      key: result.key,
      url: result.url,
    };
  }

  /** Ссылка на файл по ключу (для воспроизведения). */
  @Get('play-url')
  @UseGuards(JwtAuthGuard)
  async getPlayUrl(@Query('key') key: string) {
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('Параметр key обязателен');
    }
    if (this.useLocalStorage()) {
      const url = `${this.config.get('APP_PUBLIC_URL') ?? this.config.get('API_BASE_URL') ?? 'http://localhost:3000'}/files/play/${encodeURIComponent(key)}`;
      return { url };
    }
    return { url: this.storage.getPublicUrl(key) };
  }

  /** Стрим файла с авторизацией (для воспроизведения в браузере через fetch + blob). */
  @Get('stream')
  @UseGuards(JwtAuthGuard)
  async streamFile(@Query('key') key: string, @Res() res: Response) {
    if (!key || typeof key !== 'string') {
      return res.status(400).send('key required');
    }
    if (this.useLocalStorage()) {
      try {
        const decoded = decodeURIComponent(key);
        const filePath = this.localStorage.pathForKey(decoded);
        const st = await stat(filePath);
        if (!st.isFile()) {
          return res.status(404).send('Not found');
        }
        const ext = (
          decoded.slice(decoded.lastIndexOf('.')) || ''
        ).toLowerCase();
        const contentType =
          ext === '.mp3'
            ? 'audio/mpeg'
            : ext === '.wav'
              ? 'audio/wav'
              : ext === '.ogg'
                ? 'audio/ogg'
                : ext === '.m4a'
                  ? 'audio/mp4'
                  : ext === '.flac'
                    ? 'audio/flac'
                    : 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', String(st.size));
        const stream = createReadStream(filePath);
        return stream.pipe(res);
      } catch {
        return res.status(404).send('Not found');
      }
    }
    try {
      const decoded = decodeURIComponent(key);
      const {
        body,
        contentType: s3ContentType,
        contentLength,
      } = await this.storage.getObjectStream(decoded);
      const ext = (decoded.slice(decoded.lastIndexOf('.')) || '').toLowerCase();
      const contentType =
        s3ContentType ||
        (ext === '.mp3'
          ? 'audio/mpeg'
          : ext === '.wav'
            ? 'audio/wav'
            : ext === '.ogg'
              ? 'audio/ogg'
              : ext === '.m4a'
                ? 'audio/mp4'
                : ext === '.flac'
                  ? 'audio/flac'
                  : 'application/octet-stream');
      res.setHeader('Content-Type', contentType);
      if (contentLength != null) {
        res.setHeader('Content-Length', String(contentLength));
      }
      return (body as any).pipe(res);
    } catch (err: any) {
      if (err?.name === 'NoSuchKey') {
        return res.status(404).send('Not found');
      }
      throw err;
    }
  }

  /** Раздача файлов из локального хранилища — постоянная ссылка, без авторизации. */
  @Get('play/:key')
  async serveLocalFile(@Param('key') keyParam: string, @Res() res: Response) {
    if (this.config.get<string>('STORAGE_TYPE') !== 'local') {
      return res.status(404).send('Not found');
    }
    try {
      const key = decodeURIComponent(keyParam);
      const filePath = this.localStorage.pathForKey(key);
      const st = await stat(filePath);
      if (!st.isFile()) {
        return res.status(404).send('Not found');
      }
      const ext = (key.slice(key.lastIndexOf('.')) || '').toLowerCase();
      const contentType =
        ext === '.mp3'
          ? 'audio/mpeg'
          : ext === '.wav'
            ? 'audio/wav'
            : ext === '.ogg'
              ? 'audio/ogg'
              : ext === '.m4a'
                ? 'audio/mp4'
                : ext === '.flac'
                  ? 'audio/flac'
                  : ext === '.png'
                    ? 'image/png'
                    : ext === '.jpg' || ext === '.jpeg'
                      ? 'image/jpeg'
                      : ext === '.gif'
                        ? 'image/gif'
                        : ext === '.webp'
                          ? 'image/webp'
                          : ext === '.svg'
                            ? 'image/svg+xml'
                            : 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(st.size));
      const stream = createReadStream(filePath);
      stream.pipe(res);
    } catch {
      res.status(404).send('Not found');
    }
  }
}
