import { parseBytesRange } from './http-range';

describe('parseBytesRange', () => {
  it('returns null without a Range header', () => {
    expect(parseBytesRange(undefined, 1000)).toBeNull();
    expect(parseBytesRange('', 1000)).toBeNull();
  });

  it('parses a closed range', () => {
    expect(parseBytesRange('bytes=0-1023', 5000)).toEqual({ start: 0, end: 1023 });
  });

  it('parses an open-ended range', () => {
    expect(parseBytesRange('bytes=100-', 5000)).toEqual({ start: 100, end: 4999 });
  });

  it('parses a suffix range', () => {
    expect(parseBytesRange('bytes=-500', 5000)).toEqual({ start: 4500, end: 4999 });
  });

  it('rejects a range past the file size', () => {
    expect(parseBytesRange('bytes=5000-6000', 5000)).toBe('invalid');
    expect(parseBytesRange('bytes=20-10', 5000)).toBe('invalid');
  });
});
