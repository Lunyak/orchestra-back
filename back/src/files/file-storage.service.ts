import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const endpoint =
      this.config.get<string>('S3_ENDPOINT') ?? 'http://localhost:9000';
    const region = this.config.get<string>('S3_REGION') ?? 'us-east-1';
    const accessKeyId =
      this.config.get<string>('S3_ACCESS_KEY') ?? 'orchestra';
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

  /** Сохранить файл в S3/MinIO и вернуть ключ + временную ссылку для доступа. */
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

    const url = await this.getSignedUrl(key);
    return { bucket: this.bucket, key, url };
  }

  /** Получить временную (signed) ссылку на уже сохранённый объект. */
  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
  }

  private buildKey(params: { projectId: string; type: string; fileName: string }): string {
    const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const ts = Date.now();
    return `${params.projectId}/${params.type}/${ts}-${safeName}`;
  }
}

