import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminGuard } from './admin.guard';
import { FileStorageService } from '../files/file-storage.service';
import { LocalFileStorageService } from '../files/local-file-storage.service';
import {
  THEATER_KIT_PREFIX,
  THEATER_KIT_SLOTS,
  isTheaterKitKey,
  theaterKitSlotByFileName,
} from './theater-kit-catalog';

const GLB_LIMIT = 80 * 1024 * 1024;

type UploadedBin = {
  originalname: string;
  mimetype?: string;
  buffer: Buffer;
};

@UseGuards(AdminGuard)
@Controller('admin/theater-assets')
export class AdminTheaterAssetsController {
  constructor(
    private readonly config: ConfigService,
    private readonly s3Storage: FileStorageService,
    private readonly localStorage: LocalFileStorageService,
  ) {}

  private useLocalStorage(): boolean {
    return this.config.get<string>('STORAGE_TYPE') === 'local';
  }

  private storage() {
    return this.useLocalStorage() ? this.localStorage : this.s3Storage;
  }

  private publicUrl(key: string): string {
    return this.useLocalStorage()
      ? this.localStorage.getPublicUrl(key)
      : this.s3Storage.getPublicUrl(key);
  }

  private contentTypeFor(fileName: string, fallback?: string): string {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.glb')) return 'model/gltf-binary';
    if (lower.endsWith('.gltf')) return 'model/gltf+json';
    return fallback || 'application/octet-stream';
  }

  private assertGlbFile(file: UploadedBin) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Файл не передан');
    }
    const name = String(file.originalname ?? '').toLowerCase();
    if (!name.endsWith('.glb') && !name.endsWith('.gltf')) {
      throw new BadRequestException('Нужен файл .glb или .gltf');
    }
    if (name.endsWith('.glb')) {
      const magic = file.buffer.subarray(0, 4).toString('ascii');
      if (magic !== 'glTF') {
        throw new BadRequestException('Файл не похож на GLB');
      }
    }
  }

  private normalizeTheaterKey(raw: string): string {
    const v = typeof raw === 'string' ? raw.trim() : '';
    const normalized = v.replace(/^\/+/, '').replace(/\\/g, '/');
    if (!isTheaterKitKey(normalized)) {
      throw new BadRequestException('Ключ должен начинаться с theater/');
    }
    if (!normalized.toLowerCase().endsWith('.glb') && !normalized.toLowerCase().endsWith('.gltf')) {
      throw new BadRequestException('Ключ должен указывать на .glb/.gltf');
    }
    return normalized;
  }

  @Get()
  async list() {
    const objects = await this.storage().listObjectInfos(THEATER_KIT_PREFIX);
    const byKey = new Map(objects.map((item) => [item.key, item]));
    const slots = THEATER_KIT_SLOTS.map((slot) => {
      const found = byKey.get(slot.key);
      return {
        ...slot,
        present: Boolean(found),
        size: found?.size ?? null,
        lastModified: found?.lastModified ?? null,
        url: this.publicUrl(slot.key),
      };
    });
    const known = new Set(THEATER_KIT_SLOTS.map((slot) => slot.key));
    const extras = objects
      .filter((item) => !known.has(item.key))
      .map((item) => ({
        key: item.key,
        size: item.size,
        lastModified: item.lastModified,
        url: this.publicUrl(item.key),
      }));
    const missing = slots.filter((slot) => !slot.present).length;
    return {
      prefix: THEATER_KIT_PREFIX,
      missing,
      total: slots.length,
      slots,
      extras,
    };
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: GLB_LIMIT },
    }),
  )
  async upload(
    @UploadedFile() file: UploadedBin,
    @Query('key') keyParam?: string,
  ) {
    this.assertGlbFile(file);
    const fromName = theaterKitSlotByFileName(file.originalname);
    const rawKey = keyParam?.trim() || fromName?.key;
    if (!rawKey) {
      throw new BadRequestException(
        'Укажите key или загрузите файл с именем из каталога (например stage-spotlight.glb)',
      );
    }
    const key = this.normalizeTheaterKey(rawKey);
    const result = await this.storage().uploadObjectAtKey({
      key,
      buffer: file.buffer,
      contentType: this.contentTypeFor(file.originalname, file.mimetype),
    });
    return { key: result.key, url: result.url };
  }

  @Post('upload-many')
  @UseInterceptors(
    FilesInterceptor('files', 80, {
      storage: memoryStorage(),
      limits: { fileSize: GLB_LIMIT },
    }),
  )
  async uploadMany(@UploadedFiles() files: UploadedBin[]) {
    if (!files?.length) throw new BadRequestException('Файлы не переданы');
    const uploaded: Array<{ key: string; url: string; name: string }> = [];
    const errors: Array<{ name: string; message: string }> = [];
    for (const file of files) {
      try {
        this.assertGlbFile(file);
        const slot = theaterKitSlotByFileName(file.originalname);
        if (!slot) {
          throw new BadRequestException(
            `Неизвестный файл «${file.originalname}». Имя должно совпадать со слотом.`,
          );
        }
        const result = await this.storage().uploadObjectAtKey({
          key: slot.key,
          buffer: file.buffer,
          contentType: this.contentTypeFor(file.originalname, file.mimetype),
        });
        uploaded.push({
          key: result.key,
          url: result.url,
          name: file.originalname,
        });
      } catch (err) {
        errors.push({
          name: file.originalname,
          message: err instanceof Error ? err.message : 'Ошибка загрузки',
        });
      }
    }
    return { uploaded, errors };
  }

  @Delete()
  async remove(@Query('key') keyParam: string) {
    const key = this.normalizeTheaterKey(keyParam);
    await this.storage().deleteObject(key);
    return { ok: true, key };
  }
}
