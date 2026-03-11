import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs/promises';
import { FileStorageService } from '../files/file-storage.service';
import { LocalFileStorageService } from '../files/local-file-storage.service';

type SiteEventViewsDocV1 = {
  version: 1;
  updatedAt: string;
  events: Record<string, { total: number; lastHitAt: string }>;
};

const DEFAULT_DOC: SiteEventViewsDocV1 = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  events: {},
};

const STORAGE_KEY = 'site/analytics/event-views.json';

function normalizeSlug(raw: unknown): string | null {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v) return null;
  if (v.length > 120) return null;
  // Prevent weird keys like "../x" or absolute paths.
  if (v.includes('..') || v.includes('/') || v.includes('\\')) return null;
  return v;
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (c: any) =>
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
    );
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

@Injectable()
export class SiteEventViewsService {
  private readonly locks = new Map<string, Promise<void>>();

  constructor(
    private readonly config: ConfigService,
    private readonly s3Storage: FileStorageService,
    private readonly localStorage: LocalFileStorageService,
  ) {}

  private useLocalStorage(): boolean {
    return this.config.get<string>('STORAGE_TYPE') === 'local';
  }

  private async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((r) => (release = r));
    const chain = prev.then(() => next);
    this.locks.set(key, chain);
    try {
      await prev;
      return await fn();
    } finally {
      release();
      // Cleanup when this is the tail of the chain.
      if (this.locks.get(key) === chain) {
        this.locks.delete(key);
      }
    }
  }

  private async readDoc(): Promise<SiteEventViewsDocV1> {
    if (this.useLocalStorage()) {
      try {
        const p = this.localStorage.pathForKey(STORAGE_KEY);
        const raw = await fs.readFile(p, 'utf-8');
        const parsed = JSON.parse(raw) as SiteEventViewsDocV1;
        if (
          parsed &&
          typeof parsed === 'object' &&
          parsed.version === 1 &&
          typeof parsed.updatedAt === 'string' &&
          parsed.events &&
          typeof parsed.events === 'object'
        ) {
          return parsed;
        }
        return { ...DEFAULT_DOC };
      } catch (e: any) {
        if (e?.code === 'ENOENT') return { ...DEFAULT_DOC };
        return { ...DEFAULT_DOC };
      }
    }

    try {
      const { body } = await this.s3Storage.getObjectStream(STORAGE_KEY);
      const buf = await streamToBuffer(body);
      const raw = buf.toString('utf-8');
      const parsed = JSON.parse(raw) as SiteEventViewsDocV1;
      if (
        parsed &&
        typeof parsed === 'object' &&
        parsed.version === 1 &&
        typeof parsed.updatedAt === 'string' &&
        parsed.events &&
        typeof parsed.events === 'object'
      ) {
        return parsed;
      }
      return { ...DEFAULT_DOC };
    } catch {
      return { ...DEFAULT_DOC };
    }
  }

  private async writeDoc(doc: SiteEventViewsDocV1): Promise<void> {
    const normalized: SiteEventViewsDocV1 = {
      version: 1,
      updatedAt: doc.updatedAt,
      events: doc.events ?? {},
    };
    const json = JSON.stringify(normalized, null, 2) + '\n';
    const buffer = Buffer.from(json, 'utf-8');
    const storage = this.useLocalStorage() ? this.localStorage : this.s3Storage;
    await storage.uploadObjectAtKey({
      key: STORAGE_KEY,
      buffer,
      contentType: 'application/json; charset=utf-8',
    });
  }

  async hitEventView(eventSlug: unknown): Promise<{ slug: string; total: number }> {
    const slug = normalizeSlug(eventSlug);
    if (!slug) {
      // Treat invalid slug as no-op.
      return { slug: '', total: 0 };
    }

    return this.runExclusive(STORAGE_KEY, async () => {
      const now = new Date().toISOString();
      const doc = await this.readDoc();
      const current = doc.events?.[slug]?.total ?? 0;
      const next = Math.max(0, Math.trunc(current)) + 1;
      doc.events = doc.events ?? {};
      doc.events[slug] = { total: next, lastHitAt: now };
      doc.updatedAt = now;
      await this.writeDoc(doc);
      return { slug, total: next };
    });
  }

  async getEventViews(): Promise<{
    version: 1;
    updatedAt: string;
    events: Array<{ slug: string; total: number; lastHitAt: string }>;
  }> {
    const doc = await this.readDoc();
    const events = Object.entries(doc.events ?? {})
      .map(([slug, v]) => ({
        slug,
        total: Math.max(0, Math.trunc(v?.total ?? 0)),
        lastHitAt: typeof v?.lastHitAt === 'string' ? v.lastHitAt : '',
      }))
      .sort((a, b) => b.total - a.total || a.slug.localeCompare(b.slug));
    return { version: 1, updatedAt: doc.updatedAt, events };
  }
}

