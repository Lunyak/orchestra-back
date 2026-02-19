import { Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import axios from 'axios';
import googleTTS from 'google-tts-api';

const execFileAsync = promisify(execFile);

function isDarwin() {
  return process.platform === 'darwin';
}

function safeText(input: string) {
  return String(input ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function chunkTextForGoogleTts(text: string): string[] {
  const t = safeText(text);
  if (!t) return [];
  // google-tts-api already chunks internally, but we keep a reasonable cap for safety.
  if (t.length <= 1500) return [t];
  const parts: string[] = [];
  let i = 0;
  while (i < t.length) {
    parts.push(t.slice(i, i + 1500));
    i += 1500;
  }
  return parts;
}

@Injectable()
export class TtsService {
  private cacheDir = path.join(os.tmpdir(), 'orchestra-tts-cache');

  async listMacVoices(): Promise<Array<{ name: string; locale?: string }>> {
    if (!isDarwin()) return [];
    const { stdout } = await execFileAsync('say', ['-v', '?'], { timeout: 15_000 });
    const lines = String(stdout ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    // Example line: "Milena                ru_RU    # ... comment"
    const out: Array<{ name: string; locale?: string }> = [];
    for (const l of lines) {
      const m = /^(\S+)\s+([a-z]{2}_[A-Z]{2})\b/.exec(l);
      if (m?.[1]) {
        out.push({ name: m[1], locale: m[2] });
        continue;
      }
      const m2 = /^(\S+)\s+([a-z]{2}-[A-Z]{2})\b/.exec(l);
      if (m2?.[1]) out.push({ name: m2[1], locale: m2[2] });
    }
    return out;
  }

  async listVoices(): Promise<Array<{ name: string; locale?: string }>> {
    if (isDarwin()) return await this.listMacVoices();
    return [{ name: 'google', locale: 'ru-RU' }];
  }

  private async synthGoogleMp3(opts: { text: string }): Promise<Buffer> {
    const text = safeText(opts.text);
    if (!text) return Buffer.from([]);
    if (text.length > 4000) throw new Error('Text too long for TTS (max 4000 chars).');

    const key = crypto
      .createHash('sha1')
      .update(JSON.stringify({ p: 'google', t: text }))
      .digest('hex');

    await fs.mkdir(this.cacheDir, { recursive: true });
    const outMp3 = path.join(this.cacheDir, `${key}.mp3`);
    try {
      const stat = await fs.stat(outMp3);
      if (stat.isFile() && stat.size > 0) return await fs.readFile(outMp3);
    } catch {
      // ignore
    }

    const chunks = chunkTextForGoogleTts(text);
    const buffers: Buffer[] = [];
    for (const c of chunks) {
      const urls = googleTTS.getAllAudioUrls(c, {
        lang: 'ru',
        slow: false,
        host: 'https://translate.google.com',
      });
      for (const u of urls) {
        const url = String((u as any)?.url ?? '');
        if (!url) continue;
        const resp = await axios.get<ArrayBuffer>(url, {
          responseType: 'arraybuffer',
          timeout: 20_000,
          headers: {
            // keep it browser-like
            'User-Agent': 'Mozilla/5.0',
          },
        });
        buffers.push(Buffer.from(resp.data));
      }
    }

    const out = Buffer.concat(buffers);
    await fs.writeFile(outMp3, out);
    return out;
  }

  private async synthMacM4a(opts: { text: string; voice?: string | null }): Promise<Buffer> {
    if (!isDarwin()) {
      throw new Error('TTS is only implemented for macOS (say/afconvert) in this build.');
    }
    const text = safeText(opts.text);
    if (!text) return Buffer.from([]);
    if (text.length > 2500) throw new Error('Text too long for TTS (max 2500 chars).');

    const voice = safeText(opts.voice ?? '');
    const key = crypto
      .createHash('sha1')
      .update(JSON.stringify({ v: voice || 'auto', t: text }))
      .digest('hex');

    await fs.mkdir(this.cacheDir, { recursive: true });
    const outM4a = path.join(this.cacheDir, `${key}.m4a`);
    try {
      const stat = await fs.stat(outM4a);
      if (stat.isFile() && stat.size > 0) return await fs.readFile(outM4a);
    } catch {
      // ignore
    }

    const tmpAiff = path.join(this.cacheDir, `${key}.${process.pid}.aiff`);
    const args = ['-o', tmpAiff];
    if (voice) args.unshift(voice, '-v');
    args.push(text);

    await execFileAsync('say', args, { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 });
    await execFileAsync(
      'afconvert',
      ['-f', 'm4af', '-d', 'aac', tmpAiff, outM4a],
      { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 },
    );

    try {
      await fs.unlink(tmpAiff);
    } catch {
      // ignore
    }

    return await fs.readFile(outM4a);
  }

  async synth(opts: { text: string; voice?: string | null }): Promise<{ buf: Buffer; mime: string }> {
    if (isDarwin()) {
      const buf = await this.synthMacM4a(opts);
      return { buf, mime: 'audio/mp4' };
    }
    const buf = await this.synthGoogleMp3({ text: opts.text });
    return { buf, mime: 'audio/mpeg' };
  }
}

