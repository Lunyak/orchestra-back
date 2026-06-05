import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface StoredFileInfo {
  bucket: string;
  key: string;
  url: string;
}

/** Локальное хранилище на диске: постоянные ссылки без срока действия, без MinIO. */
@Injectable()
export class LocalFileStorageService {
  private readonly storagePath: string;
  private readonly publicBaseUrl: string;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.storagePath =
      this.config.get<string>('STORAGE_PATH') ??
      path.join(process.cwd(), 'uploads');
    const base =
      this.config.get<string>('APP_PUBLIC_URL') ??
      this.config.get<string>('API_BASE_URL') ??
      'http://localhost:3000';
    this.publicBaseUrl = base.replace(/\/$/, '');
  }

  /** Сохранить файл на диск и вернуть постоянную ссылку (не истекает). */
  async uploadObject(params: {
    projectId: string;
    type: 'playlist' | 'image' | 'sound' | 'model' | 'video';
    fileName: string;
    buffer: Buffer;
    contentType?: string;
  }): Promise<StoredFileInfo> {
    const key = this.buildKey(params);
    const fullPath = this.keyToPath(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, params.buffer);
    const url = `${this.publicBaseUrl}/files/play/${encodeURIComponent(key)}`;
    return { bucket: 'local', key, url };
  }

  /** Сохранить файл на диск по фиксированному ключу (для стабильных URL). */
  async uploadObjectAtKey(params: {
    key: string;
    buffer: Buffer;
    contentType?: string;
  }): Promise<StoredFileInfo> {
    const key = this.normalizeKey(params.key);
    const fullPath = this.keyToPath(key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, params.buffer);
    const url = `${this.publicBaseUrl}/files/play/${encodeURIComponent(key)}`;
    return { bucket: 'local', key, url };
  }

  /** Путь к файлу по ключу (для раздачи). Защита от directory traversal. */
  pathForKey(key: string): string {
    const decoded = decodeURIComponent(key);
    if (decoded.includes('..') || path.isAbsolute(decoded)) {
      throw new Error('Invalid key');
    }
    const fullPath = path.resolve(this.storagePath, decoded);
    const base = path.resolve(this.storagePath);
    if (!fullPath.startsWith(base)) {
      throw new Error('Invalid key');
    }
    return fullPath;
  }

  /** Проверить существование файла. */
  async exists(key: string): Promise<boolean> {
    try {
      const p = this.pathForKey(key);
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  /** Удалить файл по ключу (освобождение места при удалении из сцены). */
  async deleteObject(key: string): Promise<void> {
    try {
      const p = this.pathForKey(key);
      await fs.unlink(p);
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        console.warn(
          '[LocalFileStorage] deleteObject failed:',
          key,
          err?.message,
        );
      }
    }
  }

  private keyToPath(key: string): string {
    return path.join(this.storagePath, key.replace(/\.\./g, ''));
  }

  private normalizeKey(raw: string): string {
    const v = typeof raw === 'string' ? raw.trim() : '';
    if (!v) throw new Error('Invalid key');
    const normalized = v.replace(/^\/+/, '').replace(/\\/g, '/');
    if (normalized.includes('..') || path.isAbsolute(normalized)) {
      throw new Error('Invalid key');
    }
    return normalized;
  }

  private buildKey(params: {
    projectId: string;
    type: string;
    fileName: string;
  }): string {
    const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const ts = Date.now();
    const random = Math.random().toString(36).slice(2, 10);
    return `${params.projectId}/${params.type}/${ts}-${random}-${safeName}`;
  }
}
