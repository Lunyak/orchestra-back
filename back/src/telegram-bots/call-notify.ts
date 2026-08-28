export const CALL_NOTIFY_MODES = [
  'on_publish',
  'same_day',
  'advance',
] as const;

export type CallNotifyMode = (typeof CALL_NOTIFY_MODES)[number];

export type CallNotifySettings = {
  mode: CallNotifyMode;
  advanceDays: number;
  hour: number;
  availabilityRemindEnabled: boolean;
};

export const CALL_NOTIFY_DEFAULTS: CallNotifySettings = {
  mode: 'on_publish',
  advanceDays: 1,
  hour: 12,
  availabilityRemindEnabled: false,
};

const MOSCOW_TZ = 'Europe/Moscow';
const MONTH_LOOKAHEAD_DAYS = 30;

type PrismaLike = {
  $queryRawUnsafe: (
    query: string,
    ...values: unknown[]
  ) => Promise<unknown>;
  troupe: {
    findMany: (args: {
      where: { ownerUserId: string };
      select: { id: true };
    }) => Promise<Array<{ id: string }>>;
  };
  troupeMember: {
    findMany: (args: {
      where: { troupeId: { in: string[] } };
      select: { email: true };
    }) => Promise<Array<{ email: string }>>;
  };
  userProfile: {
    findMany: (args: {
      where: { email: { in: string[] } };
      select: {
        email: true;
        telegramId: true;
        displayName: true;
        firstName: true;
        lastName: true;
        availabilityCalendar: true;
        availabilityTimeRanges: true;
      };
    }) => Promise<
      Array<{
        email: string;
        telegramId: string | null;
        displayName: string | null;
        firstName: string | null;
        lastName: string | null;
        availabilityCalendar: unknown;
        availabilityTimeRanges: unknown;
      }>
    >;
  };
};

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function parseCallNotifyMode(raw: unknown): CallNotifyMode {
  const value = String(raw ?? '').trim();
  if (value === 'same_day' || value === 'advance' || value === 'on_publish') {
    return value;
  }
  return CALL_NOTIFY_DEFAULTS.mode;
}

export function parseCallNotifySettings(
  row: Partial<{
    callNotifyMode: unknown;
    callNotifyAdvanceDays: unknown;
    callNotifyHour: unknown;
    availabilityRemindEnabled: unknown;
  }> | null,
): CallNotifySettings {
  return {
    mode: parseCallNotifyMode(row?.callNotifyMode),
    advanceDays: clampInt(
      row?.callNotifyAdvanceDays,
      1,
      14,
      CALL_NOTIFY_DEFAULTS.advanceDays,
    ),
    hour: clampInt(row?.callNotifyHour, 0, 23, CALL_NOTIFY_DEFAULTS.hour),
    availabilityRemindEnabled: Boolean(row?.availabilityRemindEnabled),
  };
}

export function callNotifyApiFields(row: Parameters<typeof parseCallNotifySettings>[0]) {
  const settings = parseCallNotifySettings(row);
  return {
    callNotifyMode: settings.mode,
    callNotifyAdvanceDays: settings.advanceDays,
    callNotifyHour: settings.hour,
    availabilityRemindEnabled: settings.availabilityRemindEnabled,
  };
}

export function moscowDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MOSCOW_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function moscowHour(date = new Date()): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: MOSCOW_TZ,
    hour: '2-digit',
    hour12: false,
  }).format(date);
  return clampInt(hour.replace(/^24$/, '0'), 0, 23, 0);
}

export function shiftDateKey(dateKey: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey ?? '').trim());
  if (!match) return dateKey;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const yyyy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function monthAheadDateKeys(now = new Date()): string[] {
  const start = moscowDateKey(now);
  const keys: string[] = [];
  for (let i = 0; i < MONTH_LOOKAHEAD_DAYS; i += 1) {
    keys.push(shiftDateKey(start, i));
  }
  return keys;
}

function parseTimeHHMM(src: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(src ?? '').trim());
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

export function profileHasSpecifiedAvailabilityForDate(
  profile: {
    availabilityCalendar?: unknown;
    availabilityTimeRanges?: unknown;
  } | null,
  dateKey: string,
): boolean {
  if (!profile || !dateKey) return false;
  const calendar = profile.availabilityCalendar as
    | Record<string, unknown>
    | null
    | undefined;
  const day = calendar?.[dateKey];
  if (day === 'present' || day === 'absent') return true;
  const ranges = (
    profile.availabilityTimeRanges as Record<string, unknown> | null | undefined
  )?.[dateKey];
  if (!Array.isArray(ranges) || ranges.length === 0) return false;
  for (const item of ranges.slice(0, 20)) {
    const fromMin = parseTimeHHMM(String((item as { from?: unknown })?.from ?? ''));
    const toMin = parseTimeHHMM(String((item as { to?: unknown })?.to ?? ''));
    if (fromMin == null || toMin == null) continue;
    if (fromMin >= toMin) continue;
    return true;
  }
  return false;
}

export function isScheduledCallDue(
  startsAt: Date | string,
  settings: CallNotifySettings,
  now = new Date(),
): boolean {
  if (settings.mode === 'on_publish') return false;
  const start = startsAt instanceof Date ? startsAt : new Date(startsAt);
  if (Number.isNaN(start.getTime())) return false;
  const eventDate = moscowDateKey(start);
  const today = moscowDateKey(now);
  if (today > eventDate) return false;
  const targetDate =
    settings.mode === 'same_day'
      ? eventDate
      : shiftDateKey(eventDate, -settings.advanceDays);
  if (today < targetDate) return false;
  if (today > targetDate) return true;
  return moscowHour(now) >= settings.hour;
}

export function shouldSendTelegramOnPublish(
  settings: CallNotifySettings,
  alreadySent: boolean,
  startsAt: Date | string,
  now = new Date(),
): boolean {
  if (alreadySent) return true;
  if (settings.mode === 'on_publish') return true;
  return isScheduledCallDue(startsAt, settings, now);
}

export async function loadCallNotifySettings(
  prisma: PrismaLike,
  botId: string,
): Promise<CallNotifySettings> {
  const id = String(botId ?? '').trim();
  if (!id) return { ...CALL_NOTIFY_DEFAULTS };
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT "callNotifyMode","callNotifyAdvanceDays","callNotifyHour","availabilityRemindEnabled"
     FROM "TelegramBotIntegration" WHERE "id" = $1 LIMIT 1`,
    id,
  )) as Array<{
    callNotifyMode: string | null;
    callNotifyAdvanceDays: number | null;
    callNotifyHour: number | null;
    availabilityRemindEnabled: boolean | null;
  }>;
  return parseCallNotifySettings(rows[0] ?? null);
}

export type AvailabilityGapRecipient = {
  telegramId: string;
  email: string;
  name?: string;
  missingDays: number;
};

function profileDisplayName(profile: {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
}): string | undefined {
  const display = String(profile.displayName ?? '').trim();
  if (display) return display;
  const joined = [profile.firstName, profile.lastName]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  return joined || undefined;
}

export async function collectMonthAvailabilityGaps(
  prisma: PrismaLike,
  ownerUserId: string,
): Promise<AvailabilityGapRecipient[]> {
  const ownerId = String(ownerUserId ?? '').trim();
  if (!ownerId) return [];
  const troupes = await prisma.troupe.findMany({
    where: { ownerUserId: ownerId },
    select: { id: true },
  });
  const troupeIds = troupes.map((troupe) => troupe.id);
  if (troupeIds.length === 0) return [];
  const members = await prisma.troupeMember.findMany({
    where: { troupeId: { in: troupeIds } },
    select: { email: true },
  });
  const emails = Array.from(
    new Set(
      members
        .map((member) => String(member.email ?? '').trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  if (emails.length === 0) return [];
  const profiles = await prisma.userProfile.findMany({
    where: { email: { in: emails } },
    select: {
      email: true,
      telegramId: true,
      displayName: true,
      firstName: true,
      lastName: true,
      availabilityCalendar: true,
      availabilityTimeRanges: true,
    },
  });
  const dateKeys = monthAheadDateKeys();
  const recipients: AvailabilityGapRecipient[] = [];
  for (const profile of profiles) {
    const telegramId = String(profile.telegramId ?? '').trim();
    if (!telegramId) continue;
    let missingDays = 0;
    for (const dateKey of dateKeys) {
      if (!profileHasSpecifiedAvailabilityForDate(profile, dateKey)) {
        missingDays += 1;
      }
    }
    if (missingDays === 0) continue;
    recipients.push({
      telegramId,
      email: String(profile.email ?? '').trim().toLowerCase(),
      name: profileDisplayName(profile),
      missingDays,
    });
  }
  return recipients;
}
