import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Headers,
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
import { stat } from 'node:fs/promises';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileStorageService } from './file-storage.service';
import { LocalFileStorageService } from './local-file-storage.service';
import { contentTypeForFileName } from './file-content-type';
import { sendLocalFileWithRange } from './http-range';

export class UploadFileDto {
  @IsString()
  projectId: string;

  @IsString()
  @IsIn(['playlist', 'image', 'sound', 'model', 'video'])
  type: 'playlist' | 'image' | 'sound' | 'model' | 'video';
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
        fileSize: 500 * 1024 * 1024, // 500MB (видео для проектора)
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
  async streamFile(
    @Query('key') key: string,
    @Headers('range') range: string | undefined,
    @Res() res: Response,
  ) {
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
        sendLocalFileWithRange({
          res,
          filePath,
          size: st.size,
          contentType: contentTypeForFileName(decoded),
          rangeHeader: range,
        });
        return;
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
        contentRange,
        statusCode,
      } = await this.storage.getObjectStream(decoded, range);
      const contentType = s3ContentType || contentTypeForFileName(decoded);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', contentType);
      if (contentLength != null) {
        res.setHeader('Content-Length', String(contentLength));
      }
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }
      res.status(statusCode);
      return (body as any).pipe(res);
    } catch (err: any) {
      if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
        return res.status(404).send('Not found');
      }
      if (err?.$metadata?.httpStatusCode === 416) {
        return res.status(416).send('Range Not Satisfiable');
      }
      throw err;
    }
  }

  /** Раздача файлов из локального хранилища — постоянная ссылка, без авторизации. */
  @Get('play/:key')
  async serveLocalFile(
    @Param('key') keyParam: string,
    @Headers('range') range: string | undefined,
    @Res() res: Response,
  ) {
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
      sendLocalFileWithRange({
        res,
        filePath,
        size: st.size,
        contentType: contentTypeForFileName(key),
        rangeHeader: range,
      });
    } catch {
      res.status(404).send('Not found');
    }
  }
}
