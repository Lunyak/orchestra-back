import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileStorageService } from './file-storage.service';
import { FilesController } from './files.controller';
import { LocalFileStorageService } from './local-file-storage.service';

const VIDEO_BYTES = Buffer.from(
  'fake-orchestra-projector-video-bytes-for-play-and-range-checks',
);

describe('FilesController projector video load', () => {
  let app: INestApplication;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'orchestra-files-play-'));
    const moduleRef = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        LocalFileStorageService,
        {
          provide: FileStorageService,
          useValue: {
            getPublicUrl: (key: string) => `http://s3.test/${key}`,
            getObjectStream: async () => {
              const err = new Error('missing');
              (err as { name: string }).name = 'NoSuchKey';
              throw err;
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'STORAGE_TYPE') return 'local';
              if (key === 'STORAGE_PATH') return tmpDir;
              if (key === 'APP_PUBLIC_URL' || key === 'API_BASE_URL') {
                return 'http://localhost:3000';
              }
              return undefined;
            },
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('uploads a video, returns play-url, and serves Range bytes', async () => {
    const uploaded = await request(app.getHttpServer())
      .post('/files/upload')
      .field('projectId', 'hamlet')
      .field('type', 'video')
      .attach('file', VIDEO_BYTES, {
        filename: 'clip.mp4',
        contentType: 'video/mp4',
      });
    expect([200, 201]).toContain(uploaded.status);

    expect(uploaded.body.key).toEqual(expect.stringContaining('hamlet/video/'));
    expect(uploaded.body.url).toEqual(
      expect.stringContaining('/files/play/'),
    );

    const playUrl = await request(app.getHttpServer())
      .get('/files/play-url')
      .query({ key: uploaded.body.key })
      .expect(200);

    expect(playUrl.body.url).toContain('/files/play/');
    expect(playUrl.body.url).toContain(encodeURIComponent(uploaded.body.key));

    const full = await request(app.getHttpServer())
      .get(`/files/play/${encodeURIComponent(uploaded.body.key)}`)
      .expect(200);

    expect(full.headers['content-type']).toMatch(/video\/mp4/i);
    expect(full.headers['accept-ranges']).toBe('bytes');
    expect(Buffer.from(full.body).length).toBe(VIDEO_BYTES.length);

    const ranged = await request(app.getHttpServer())
      .get(`/files/play/${encodeURIComponent(uploaded.body.key)}`)
      .set('Range', 'bytes=0-15')
      .expect(206);

    expect(ranged.headers['content-range']).toBe(
      `bytes 0-15/${VIDEO_BYTES.length}`,
    );
    expect(Buffer.from(ranged.body).length).toBe(16);

    const streamed = await request(app.getHttpServer())
      .get('/files/stream')
      .query({ key: uploaded.body.key })
      .set('Range', 'bytes=0-7')
      .expect(206);

    expect(Buffer.from(streamed.body).length).toBe(8);
  });
});
