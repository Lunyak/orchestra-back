import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  compareDesktopVersions,
  isSafeReleaseFileName,
  isSafeReleaseVersion,
  parseDesktopArtifactName,
  type DesktopRelease,
  type DesktopReleaseArtifact,
} from './desktop-releases.util';

export type DesktopReleasesList = {
  latest: DesktopRelease | null;
  releases: DesktopRelease[];
};

export type DesktopReleaseFile = {
  fileName: string;
  filePath: string;
  size: number;
};

@Injectable()
export class DesktopReleasesService {
  constructor(private readonly config: ConfigService) {}

  resolveRootDir(): string {
    const fromEnv = this.config.get<string>('DESKTOP_RELEASES_DIR')?.trim();
    if (fromEnv) return path.resolve(fromEnv);

    const sibling = path.resolve(process.cwd(), '../desktop/release');
    if (existsSync(sibling)) return sibling;

    return path.resolve(process.cwd(), 'data/desktop-releases');
  }

  async list(): Promise<DesktopReleasesList> {
    const rootDir = this.resolveRootDir();
    const releases = await this.listFromDir(rootDir);
    return {
      latest: releases[0] ?? null,
      releases,
    };
  }

  async resolveArtifact(
    version: string,
    fileName: string,
  ): Promise<DesktopReleaseFile | null> {
    if (!isSafeReleaseVersion(version) || !isSafeReleaseFileName(fileName)) {
      return null;
    }
    if (!parseDesktopArtifactName(fileName)) return null;

    const rootDir = this.resolveRootDir();
    const filePath = path.resolve(rootDir, version, fileName);
    if (!this.isInsideRoot(rootDir, filePath)) return null;

    try {
      const st = await stat(filePath);
      if (!st.isFile()) return null;
      return { fileName, filePath, size: st.size };
    } catch {
      return null;
    }
  }

  private async listFromDir(rootDir: string): Promise<DesktopRelease[]> {
    let entries: string[] = [];
    try {
      entries = await readdir(rootDir);
    } catch {
      return [];
    }

    const releases: DesktopRelease[] = [];
    for (const version of entries) {
      if (!isSafeReleaseVersion(version)) continue;
      const versionDir = path.join(rootDir, version);
      let st;
      try {
        st = await stat(versionDir);
      } catch {
        continue;
      }
      if (!st.isDirectory()) continue;

      const artifacts = await this.listArtifacts(versionDir);
      if (artifacts.length === 0) continue;

      const newest = artifacts.reduce(
        (acc, item) => Math.max(acc, item.mtimeMs),
        st.mtimeMs,
      );
      releases.push({
        version,
        publishedAt: new Date(newest).toISOString(),
        artifacts: artifacts.map(({ fileName, platform, label, size }) => ({
          fileName,
          platform,
          label,
          size,
        })),
      });
    }

    releases.sort((a, b) => compareDesktopVersions(b.version, a.version));
    return releases;
  }

  private async listArtifacts(
    versionDir: string,
  ): Promise<Array<DesktopReleaseArtifact & { mtimeMs: number }>> {
    let names: string[] = [];
    try {
      names = await readdir(versionDir);
    } catch {
      return [];
    }

    const artifacts: Array<DesktopReleaseArtifact & { mtimeMs: number }> = [];
    for (const fileName of names) {
      if (!isSafeReleaseFileName(fileName)) continue;
      const parsed = parseDesktopArtifactName(fileName);
      if (!parsed) continue;
      const filePath = path.join(versionDir, fileName);
      let st;
      try {
        st = await stat(filePath);
      } catch {
        continue;
      }
      if (!st.isFile()) continue;
      artifacts.push({
        fileName,
        platform: parsed.platform,
        label: parsed.label,
        size: st.size,
        mtimeMs: st.mtimeMs,
      });
    }

    artifacts.sort((a, b) => a.platform.localeCompare(b.platform));
    return artifacts;
  }

  private isInsideRoot(rootDir: string, candidate: string): boolean {
    const rel = path.relative(path.resolve(rootDir), path.resolve(candidate));
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  }
}
