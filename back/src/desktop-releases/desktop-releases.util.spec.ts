import {
  compareDesktopVersions,
  isSafeReleaseFileName,
  isSafeReleaseVersion,
  parseDesktopArtifactName,
} from './desktop-releases.util';

describe('desktop-releases.util', () => {
  it('accepts semver folders and rejects path tricks', () => {
    expect(isSafeReleaseVersion('1.0.0')).toBe(true);
    expect(isSafeReleaseVersion('1.2.3-beta.1')).toBe(true);
    expect(isSafeReleaseVersion('../etc')).toBe(false);
    expect(isSafeReleaseVersion('1.0.0/foo')).toBe(false);
  });

  it('accepts installer names and rejects traversal', () => {
    expect(isSafeReleaseFileName('Orchestra-Windows-1.0.0-Setup.exe')).toBe(
      true,
    );
    expect(isSafeReleaseFileName('../Setup.exe')).toBe(false);
    expect(isSafeReleaseFileName('a/b.exe')).toBe(false);
  });

  it('detects platform from electron-builder artifact names', () => {
    expect(
      parseDesktopArtifactName('Orchestra-Windows-1.0.0-Setup.exe'),
    ).toEqual({
      platform: 'windows',
      label: 'Windows',
    });
    expect(
      parseDesktopArtifactName('Orchestra-Mac-1.0.0-Installer.dmg'),
    ).toEqual({
      platform: 'mac',
      label: 'macOS',
    });
    expect(parseDesktopArtifactName('Orchestra-Linux-1.0.0.AppImage')).toEqual({
      platform: 'linux',
      label: 'Linux',
    });
    expect(parseDesktopArtifactName('builder-debug.yml')).toBeNull();
    expect(
      parseDesktopArtifactName('Orchestra-Windows-1.0.0-Setup.exe.blockmap'),
    ).toBeNull();
  });

  it('sorts versions newest-first when compared descending', () => {
    const versions = ['1.0.0', '1.10.0', '1.2.0', '2.0.0-beta', '2.0.0'];
    versions.sort((a, b) => compareDesktopVersions(b, a));
    expect(versions).toEqual([
      '2.0.0',
      '2.0.0-beta',
      '1.10.0',
      '1.2.0',
      '1.0.0',
    ]);
  });
});
