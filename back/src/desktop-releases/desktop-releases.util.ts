export type DesktopReleasePlatform = 'windows' | 'mac' | 'linux';

export type DesktopReleaseArtifact = {
  fileName: string;
  platform: DesktopReleasePlatform;
  label: string;
  size: number;
};

export type DesktopRelease = {
  version: string;
  publishedAt: string | null;
  artifacts: DesktopReleaseArtifact[];
};

const INSTALLER_EXT = new Set([
  '.exe',
  '.msi',
  '.dmg',
  '.zip',
  '.appimage',
  '.deb',
  '.rpm',
]);

const VERSION_FOLDER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.]+)?$/;
const SAFE_FILE_NAME = /^[A-Za-z0-9._+-]+$/;

export function isSafeReleaseVersion(version: string): boolean {
  return VERSION_FOLDER.test(String(version ?? '').trim());
}

export function isSafeReleaseFileName(fileName: string): boolean {
  const name = String(fileName ?? '').trim();
  if (
    !name ||
    name.includes('/') ||
    name.includes('\\') ||
    name.includes('..')
  ) {
    return false;
  }
  return SAFE_FILE_NAME.test(name);
}

export function compareDesktopVersions(a: string, b: string): number {
  const pa = parseVersionParts(a);
  const pb = parseVersionParts(b);
  const len = Math.max(pa.core.length, pb.core.length);
  for (let i = 0; i < len; i += 1) {
    const da = pa.core[i] ?? 0;
    const db = pb.core[i] ?? 0;
    if (da !== db) return da - db;
  }
  if (pa.pre && !pb.pre) return -1;
  if (!pa.pre && pb.pre) return 1;
  return pa.pre.localeCompare(pb.pre);
}

function parseVersionParts(raw: string): { core: number[]; pre: string } {
  const [coreRaw, ...preParts] = String(raw).split('-');
  const core = coreRaw.split('.').map((part) => {
    const n = Number.parseInt(part, 10);
    return Number.isFinite(n) ? n : 0;
  });
  return { core, pre: preParts.join('-') };
}

export function parseDesktopArtifactName(
  fileName: string,
): { platform: DesktopReleasePlatform; label: string } | null {
  const name = String(fileName ?? '').trim();
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return null;
  const ext = name.slice(dot).toLowerCase();
  if (!INSTALLER_EXT.has(ext)) return null;

  const stem = name.slice(0, dot).toLowerCase();
  if (
    ext === '.exe' ||
    ext === '.msi' ||
    stem.includes('windows') ||
    stem.includes('win32')
  ) {
    return { platform: 'windows', label: 'Windows' };
  }
  if (ext === '.dmg' || stem.includes('mac') || stem.includes('darwin')) {
    return { platform: 'mac', label: 'macOS' };
  }
  if (
    ext === '.appimage' ||
    ext === '.deb' ||
    ext === '.rpm' ||
    stem.includes('linux')
  ) {
    return { platform: 'linux', label: 'Linux' };
  }
  return null;
}
