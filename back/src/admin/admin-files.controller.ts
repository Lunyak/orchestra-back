import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminGuard } from './admin.guard';
import { FileStorageService } from '../files/file-storage.service';
import { LocalFileStorageService } from '../files/local-file-storage.service';

@UseGuards(AdminGuard)
@Controller('admin/files')
export class AdminFilesController {
  constructor(
    private readonly config: ConfigService,
    private readonly s3Storage: FileStorageService,
    private readonly localStorage: LocalFileStorageService,
  ) {}

  private useLocalStorage(): boolean {
    return this.config.get<string>('STORAGE_TYPE') === 'local';
  }

  private normalizePath(raw: string): string {
    const v = typeof raw === 'string' ? raw.trim() : '';
    if (!v) throw new BadRequestException('path обязателен');
    const normalized = v.replace(/^\/+/, '').replace(/\\/g, '/');
    if (!normalized || normalized.includes('..')) {
      throw new BadRequestException('Некорректный path');
    }
    return normalized;
  }

  /**
   * Upload a site media file to storage under a stable key:
   *   site/<path>
   *
   * Request:
   *  - multipart/form-data: file=<binary>
   *  - query: path=photos/vassa/0.jpg (required)
   *
   * Response:
   *  - { key, url }
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  async uploadSiteMedia(
    @UploadedFile() file: any,
    @Query('path') pathParam: string,
    @Query('prefix') prefixParam?: string,
  ) {
    if (!file) throw new BadRequestException('Файл не передан');
    if (!file?.buffer) {
      throw new BadRequestException(
        'Файл получен без buffer (ожидается multipart/form-data)',
      );
    }

    const rel = this.normalizePath(pathParam);
    const prefix = this.normalizePath((prefixParam ?? 'site') as string);
    const key = `${prefix}/${rel}`;

    const storage = this.useLocalStorage() ? this.localStorage : this.s3Storage;
    const result = await storage.uploadObjectAtKey({
      key,
      buffer: file.buffer,
      contentType: file.mimetype,
    });

    return { key: result.key, url: result.url };
  }
}

