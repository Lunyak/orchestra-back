import {
  DeleteObjectCommand,
  GetObjectCommand,
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

@Injectable()
export class FileStorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  /** Базовый URL для ссылок (тот, по которому к MinIO ходят из браузера). */
  private readonly publicBaseUrl: string;

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
    type: 'playlist' | 'image' | 'sound' | 'model';
    fileName: string;
    buffer: Buffer;
    contentType?: string;
  }): Promise<StoredFileInfo> {
    const key = this.buildKey(params);

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

  private buildKey(params: {
    projectId: string;
    type: string;
    fileName: string;
  }): string {
    const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const ts = Date.now();
    return `${params.projectId}/${params.type}/${ts}-${safeName}`;
  }
}
