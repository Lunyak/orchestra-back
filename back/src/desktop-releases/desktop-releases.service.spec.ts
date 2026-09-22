import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ConfigService } from '@nestjs/config';
import { DesktopReleasesService } from './desktop-releases.service';

describe('DesktopReleasesService', () => {
  it('lists installer artifacts and ignores builder junk', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'orchestra-releases-'));
    const v100 = path.join(root, '1.0.0');
    const v110 = path.join(root, '1.1.0');
    await mkdir(v100);
    await mkdir(v110);
    await writeFile(
      path.join(v100, 'Orchestra-Windows-1.0.0-Setup.exe'),
      'exe',
    );
    await writeFile(path.join(v100, 'builder-debug.yml'), 'yml');
    await writeFile(
      path.join(v110, 'Orchestra-Windows-1.1.0-Setup.exe'),
      'newer',
    );
    await writeFile(
      path.join(v110, 'Orchestra-Mac-1.1.0-Installer.dmg'),
      'dmg',
    );

    const service = new DesktopReleasesService({
      get: () => root,
    } as unknown as ConfigService);

    const list = await service.list();
    expect(list.latest?.version).toBe('1.1.0');
    expect(list.releases.map((item) => item.version)).toEqual([
      '1.1.0',
      '1.0.0',
    ]);
    expect(list.releases[0]?.artifacts.map((item) => item.platform)).toEqual([
      'mac',
      'windows',
    ]);
    expect(list.releases[1]?.artifacts).toHaveLength(1);

    const missing = await service.resolveArtifact('1.0.0', 'nope.exe');
    expect(missing).toBeNull();
    const found = await service.resolveArtifact(
      '1.0.0',
      'Orchestra-Windows-1.0.0-Setup.exe',
    );
    expect(found?.size).toBe(3);
  });
});
