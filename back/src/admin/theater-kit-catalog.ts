export type TheaterKitGroup =
  | 'spotlights'
  | 'rig'
  | 'doors'
  | 'humans'
  | 'library';

export type TheaterKitSlot = {
  id: string;
  group: TheaterKitGroup;
  label: string;
  key: string;
};

const LIBRARY: Array<{ assetKey: string; label: string }> = [
  { assetKey: 'wooden-chair', label: 'Деревянный стул' },
  { assetKey: 'velvet-armchair', label: 'Бархатное кресло' },
  { assetKey: 'velvet-sofa', label: 'Бархатный диван' },
  { assetKey: 'dining-table', label: 'Обеденный стол' },
  { assetKey: 'round-pedestal-table', label: 'Круглый стол' },
  { assetKey: 'bar-stool', label: 'Барный табурет' },
  { assetKey: 'wooden-bench', label: 'Деревянная скамья' },
  { assetKey: 'display-cabinet', label: 'Витринный шкаф' },
  { assetKey: 'dresser', label: 'Комод' },
  { assetKey: 'bookshelf', label: 'Книжный шкаф' },
  { assetKey: 'single-bed', label: 'Кровать' },
  { assetKey: 'room-divider', label: 'Трёхстворчатая ширма' },
  { assetKey: 'spiral-staircase', label: 'Винтовая лестница' },
  { assetKey: 'travel-trunk', label: 'Дорожный сундук' },
  { assetKey: 'vintage-suitcase', label: 'Винтажный чемодан' },
  { assetKey: 'wooden-barrel', label: 'Деревянная бочка' },
  { assetKey: 'wooden-crate', label: 'Деревянный ящик' },
  { assetKey: 'floor-lamp', label: 'Торшер' },
  { assetKey: 'candelabrum', label: 'Канделябр' },
  { assetKey: 'standing-mirror', label: 'Напольное зеркало' },
  { assetKey: 'coat-rack', label: 'Вешалка' },
  { assetKey: 'gramophone', label: 'Граммофон' },
  { assetKey: 'rotary-telephone', label: 'Дисковый телефон' },
  { assetKey: 'ceramic-vase', label: 'Керамическая ваза' },
  { assetKey: 'gilded-picture-frame', label: 'Картина в раме' },
];

function librarySlots(): TheaterKitSlot[] {
  return LIBRARY.flatMap((item) => [
    {
      id: item.assetKey,
      group: 'library' as const,
      label: item.label,
      key: `theater/library/${item.assetKey}.glb`,
    },
    {
      id: `${item.assetKey}-low`,
      group: 'library' as const,
      label: `${item.label} (low)`,
      key: `theater/library/${item.assetKey}-low.glb`,
    },
  ]);
}

export const THEATER_KIT_SLOTS: TheaterKitSlot[] = [
  {
    id: 'stage-spotlight',
    group: 'spotlights',
    label: 'Софит',
    key: 'theater/models/stage-spotlight.glb',
  },
  {
    id: 'stage-spotlight-low',
    group: 'spotlights',
    label: 'Софит (low)',
    key: 'theater/models/stage-spotlight-low.glb',
  },
  {
    id: 'stage-rgb-spotlight',
    group: 'spotlights',
    label: 'RGB-софит',
    key: 'theater/models/stage-rgb-spotlight.glb',
  },
  {
    id: 'stage-rgb-spotlight-low',
    group: 'spotlights',
    label: 'RGB-софит (low)',
    key: 'theater/models/stage-rgb-spotlight-low.glb',
  },
  {
    id: 'stage-light-truss-6m',
    group: 'rig',
    label: 'Световая ферма 6 м',
    key: 'theater/models/stage-light-truss-6m.glb',
  },
  {
    id: 'stage-light-truss-6m-low',
    group: 'rig',
    label: 'Световая ферма 6 м (low)',
    key: 'theater/models/stage-light-truss-6m-low.glb',
  },
  {
    id: 'stage-door-wood',
    group: 'doors',
    label: 'Дверь деревянная',
    key: 'theater/models/stage-door-wood.glb',
  },
  {
    id: 'stage-door-metal',
    group: 'doors',
    label: 'Дверь металлическая',
    key: 'theater/models/stage-door-metal.glb',
  },
  {
    id: 'human-standing',
    group: 'humans',
    label: 'Человек — стоит',
    key: 'theater/humans/human-standing.glb',
  },
  {
    id: 'human-sitting',
    group: 'humans',
    label: 'Человек — сидит',
    key: 'theater/humans/human-sitting.glb',
  },
  {
    id: 'theater-actor-black',
    group: 'humans',
    label: 'Актёр',
    key: 'theater/humans/theater-actor-black.glb',
  },
  {
    id: 'stage-blocking-actor',
    group: 'humans',
    label: 'Актёр для мизансцены',
    key: 'theater/humans/stage-blocking-actor.glb',
  },
  ...librarySlots(),
];

export const THEATER_KIT_PREFIX = 'theater/';

export function theaterKitSlotByFileName(
  fileName: string,
): TheaterKitSlot | undefined {
  const base = fileName.replace(/^.*[/\\]/, '').toLowerCase();
  return THEATER_KIT_SLOTS.find((slot) => slot.key.split('/').pop()?.toLowerCase() === base);
}

export function isTheaterKitKey(key: string): boolean {
  return key.startsWith(THEATER_KIT_PREFIX) && !key.includes('..');
}
