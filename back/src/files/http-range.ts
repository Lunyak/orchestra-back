import { createReadStream } from 'node:fs';
import type { Response } from 'express';

export type ParsedByteRange = { start: number; end: number };

export function parseBytesRange(
  rangeHeader: string | undefined,
  size: number,
): ParsedByteRange | 'invalid' | null {
  const raw = String(rangeHeader ?? '').trim();
  if (!raw) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(raw);
  if (!match) return 'invalid';
  const startRaw = match[1];
  const endRaw = match[2];
  if (!startRaw && !endRaw) return 'invalid';

  let start: number;
  let end: number;
  if (!startRaw) {
    const suffix = Number(endRaw);
    if (!Number.isFinite(suffix) || suffix <= 0) return 'invalid';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startRaw);
    end = endRaw ? Number(endRaw) : size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return 'invalid';
  }

  if (start < 0 || end < start || start >= size) return 'invalid';
  return { start, end: Math.min(end, size - 1) };
}

export function sendLocalFileWithRange(opts: {
  res: Response;
  filePath: string;
  size: number;
  contentType: string;
  rangeHeader?: string;
}): void {
  const { res, filePath, size, contentType, rangeHeader } = opts;
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);

  const range = parseBytesRange(rangeHeader, size);
  if (range === 'invalid') {
    res.setHeader('Content-Range', `bytes */${size}`);
    res.status(416).end();
    return;
  }
  if (!range) {
    res.setHeader('Content-Length', String(size));
    createReadStream(filePath).pipe(res);
    return;
  }

  const chunkSize = range.end - range.start + 1;
  res.status(206);
  res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
  res.setHeader('Content-Length', String(chunkSize));
  createReadStream(filePath, { start: range.start, end: range.end }).pipe(res);
}
