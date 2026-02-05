import {
    Body,
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
import { Response } from 'express';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileStorageService } from './file-storage.service';
import { LocalFileStorageService } from './local-file-storage.service';

export class UploadFileDto {
  projectId: string;
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
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    // Тип Multer в @types/express@5 отсутствует, поэтому используем any
    @UploadedFile() file: any,
    @Body() body: UploadFileDto,
    @Query() query: Partial<UploadFileDto>,
  ) {
    if (!file) {
      throw new Error('Файл не передан');
    }

    const projectId = body?.projectId ?? query?.projectId;
    const type = body?.type ?? query?.type;
    if (!projectId || !type) {
      throw new Error('projectId и type обязательны');
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
      throw new Error('Параметр key обязателен');
    }
    if (this.useLocalStorage()) {
      const url = `${this.config.get('APP_PUBLIC_URL') ?? this.config.get('API_BASE_URL') ?? 'http://localhost:3000'}/files/play/${encodeURIComponent(key)}`;
      return { url };
    }
    return { url: this.storage.getPublicUrl(key) };
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
      const ext = key.slice(key.lastIndexOf('.'));
      const contentType =
        ext === '.mp3'
          ? 'audio/mpeg'
          : ext === '.wav'
            ? 'audio/wav'
            : ext === '.ogg'
              ? 'audio/ogg'
              : ext === '.m4a'
                ? 'audio/mp4'
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

