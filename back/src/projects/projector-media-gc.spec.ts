import {
  extractReferencedImageKeysFromProjectorMedia,
  resolveProjectorStorageKey,
} from './projector-media-gc';

describe('projector-media-gc', () => {
  const holdKey =
    'cmlbf2rso000401uqc8pouqan/image/1780653259672-34fc5f15bbe4e427c600d67d45a89f79.jpg';

  it('resolves remoteKey directly', () => {
    expect(resolveProjectorStorageKey({ remoteKey: holdKey })).toBe(holdKey);
  });

  it('resolves key from MinIO public URL when remoteKey is missing', () => {
    expect(
      resolveProjectorStorageKey({
        remoteUrl: `http://213.226.126.196:9000/orchestra-media/${holdKey}`,
      }),
    ).toBe(holdKey);
  });

  it('collects hold image keys from projectorMedia.holdImages', () => {
    const keys = extractReferencedImageKeysFromProjectorMedia({
      v: 1,
      holdImages: [
        { id: 3, remoteKey: holdKey },
        {
          id: 4,
          remoteUrl:
            'http://213.226.126.196:9000/orchestra-media/cmlbf2rso000401uqc8pouqan/image/other.jpg',
        },
      ],
    });
    expect(keys).toEqual([
      holdKey,
      'cmlbf2rso000401uqc8pouqan/image/other.jpg',
    ]);
  });

  it('collects legacy projector.holdImageRemoteKey', () => {
    const keys = extractReferencedImageKeysFromProjectorMedia({
      v: 1,
      projector: { v: 1, holdImageRemoteKey: holdKey },
    });
    expect(keys).toEqual([holdKey]);
  });

  it('ignores non-v1 projectorMedia', () => {
    expect(
      extractReferencedImageKeysFromProjectorMedia({
        v: 2,
        holdImages: [{ remoteKey: holdKey }],
      }),
    ).toEqual([]);
  });
});
