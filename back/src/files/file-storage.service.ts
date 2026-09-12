import {
  DeleteObjectCommand,
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface StoredFileInfo {
  bucket: string;
  key: string;
  url: string;
}

export type StoredObjectInfo = {
  key: string;
  size: number;
  lastModified: string | null;
};

@Injectable()
export class FileStorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  /** Базовый URL для ссылок (тот, по которому к MinIO ходят из браузера). */
  private readonly publicBaseUrl: string;
  private bucketEnsured = false;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const endpoint =
      this.config.get<string>('S3_ENDPOINT') ?? 'http://localhost:9000';
    this.publicBaseUrl = (
      this.config.get<string>('S3_PUBLIC_URL') ??
      this.config.get<string>('MINIO_PUBLIC_URL') ??
      endpoint
    ).replace(/\/$/, '');
    const region = this.config.get<string>('S3_REGION') ?? 'us-east-1';
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY') ?? 'orchestra';
    const secretAccessKey =
      this.config.get<string>('S3_SECRET_KEY') ?? 'orchestra_secret';
    this.bucket = this.config.get<string>('S3_BUCKET') ?? 'orchestra-media';

    this.s3 = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }

  /** Постоянная ссылка на объект. Бакет нужно открыть на чтение через MinIO CLI (mc anonymous set download). */
  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${this.bucket}/${key}`;
  }

  /** Стрим объекта из S3 (для раздачи с авторизацией). */
  async getObjectStream(key: string): Promise<{
    body: NodeJS.ReadableStream;
    contentType?: string;
    contentLength?: number;
  }> {
    const response = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!response.Body) {
      throw new Error('Empty body');
    }
    return {
      body: response.Body as NodeJS.ReadableStream,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
    };
  }

  /** Сохранить файл в S3/MinIO и вернуть постоянную ссылку (без срока действия). */
  async uploadObject(params: {
    projectId: string;
    type: 'playlist' | 'image' | 'sound' | 'model' | 'video';
    fileName: string;
    buffer: Buffer;
    contentType?: string;
  }): Promise<StoredFileInfo> {
    const key = this.buildKey(params);

    // На проде bucket может отсутствовать (например, после чистого деплоя).
    // Тогда /files/upload падал бы с 500. Автоматически создаём bucket и повторяем.
    await this.ensureBucketExists();

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: params.buffer,
        ContentType: params.contentType,
      }),
    );

    const url = this.getPublicUrl(key);
    return { bucket: this.bucket, key, url };
  }

  /**
   * Сохранить файл в S3/MinIO по фиксированному ключу (для стабильных URL).
   * Важно: key должен быть безопасным (без ".." и без абсолютных путей).
   */
  async uploadObjectAtKey(params: {
    key: string;
    buffer: Buffer;
    contentType?: string;
  }): Promise<StoredFileInfo> {
    const key = this.normalizeKey(params.key);
    await this.ensureBucketExists();
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: params.buffer,
        ContentType: params.contentType,
      }),
    );
    const url = this.getPublicUrl(key);
    return { bucket: this.bucket, key, url };
  }

  /** Удалить объект из S3/MinIO (освобождение места при удалении из сцены). */
  async deleteObject(key: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err: any) {
      console.warn('[FileStorage] deleteObject failed:', key, err?.message);
    }
  }

  async listObjectInfos(prefix: string): Promise<StoredObjectInfo[]> {
    const out: StoredObjectInfo[] = [];
    let token: string | undefined;
    await this.ensureBucketExists();
    for (let i = 0; i < 10000; i += 1) {
      const res = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          MaxKeys: 1000,
          ContinuationToken: token,
        }),
      );
      for (const item of res.Contents ?? []) {
        if (!item.Key || item.Key.endsWith('/')) continue;
        out.push({
          key: item.Key,
          size: item.Size ?? 0,
          lastModified: item.LastModified
            ? item.LastModified.toISOString()
            : null,
        });
      }
      if (!res.IsTruncated) break;
      token = res.NextContinuationToken;
      if (!token) break;
      if (out.length > 200000) break;
    }
    return out;
  }

  /** Список ключей по префиксу (постранично). */
  async listKeys(prefix: string, limit: number = 1000): Promise<string[]> {
    const out: string[] = [];
    let token: string | undefined = undefined;
    await this.ensureBucketExists();
    for (let i = 0; i < 10000; i += 1) {
      const res = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          MaxKeys: Math.max(1, Math.min(1000, Math.trunc(limit))),
          ContinuationToken: token,
        }),
      );
      const contents = res.Contents ?? [];
      for (const it of contents) {
        const key = it.Key;
        if (key) out.push(key);
      }
      if (!res.IsTruncated) break;
      token = res.NextContinuationToken;
      if (!token) break;
      if (out.length > 200000) break;
    }
    return out;
  }

  private buildKey(params: {
    projectId: string;
    type: string;
    fileName: string;
  }): string {
    const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const ts = Date.now();
    return `${params.projectId}/${params.type}/${ts}-${safeName}`;
  }

  private async ensureBucketExists(): Promise<void> {
    if (this.bucketEnsured) return;
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.bucketEnsured = true;
      return;
    } catch {
      // continue to create
    }
    try {
      await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
    } catch {
      // ignore: bucket might have been created concurrently
    }
    this.bucketEnsured = true;
  }

  private normalizeKey(raw: string): string {
    const v = typeof raw === 'string' ? raw.trim() : '';
    if (!v) {
      throw new Error('Invalid key');
    }
    const normalized = v.replace(/^\/+/, '').replace(/\\/g, '/');
    if (normalized.includes('..')) {
      throw new Error('Invalid key');
    }
    return normalized;
  }
}
