import type { DirectorSessionSlot } from "../directorSessionsSync";
import {
  formatSlotTime,
  looksLikeEmail,
  normalizeEmail,
} from "./session-page-utils";

export type ActorCallArrival = {
  offsetMin: number;
  timeLabel: string;
};

export function emailsOnSlotFromPayload(sl: DirectorSessionSlot): string[] {
  const out = new Set<string>();
  for (const raw of sl.participantEmails ?? []) {
    const email = normalizeEmail(String(raw));
    if (email && looksLikeEmail(email)) out.add(email);
  }
  for (const pick of sl.roleRehearsalPicks ?? []) {
    if (!pick.checked) continue;
    const email = normalizeEmail(String(pick.email ?? ""));
    if (email && looksLikeEmail(email)) out.add(email);
  }
  return Array.from(out);
}

export function buildEmailsBySlotId(
  slots: DirectorSessionSlot[],
  emailsBySlotId?: Record<string, string[]> | null,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const sl of slots) {
    const mapped = emailsBySlotId?.[sl.id];
    if (mapped && mapped.length > 0) {
      out[sl.id] = mapped
        .map((email) => normalizeEmail(email))
        .filter((email) => email && looksLikeEmail(email));
      continue;
    }
    out[sl.id] = emailsOnSlotFromPayload(sl);
  }
  return out;
}

export function computeActorArrivalByEmail(
  startsAt: string,
  slots: DirectorSessionSlot[],
  emailsBySlotId?: Record<string, string[]> | null,
): Map<string, ActorCallArrival> {
  const bySlot = buildEmailsBySlotId(slots, emailsBySlotId);
  const offsetByEmail = new Map<string, number>();

  for (const sl of slots) {
    const offset = Math.max(0, Math.floor(Number(sl.offsetMin) || 0));
    for (const email of bySlot[sl.id] ?? []) {
      const prev = offsetByEmail.get(email);
      if (prev == null || offset < prev) {
        offsetByEmail.set(email, offset);
      }
    }
  }

  const result = new Map<string, ActorCallArrival>();
  for (const [email, offsetMin] of offsetByEmail) {
    result.set(email, {
      offsetMin,
      timeLabel: formatSlotTime(startsAt, offsetMin),
    });
  }
  return result;
}

export function compareActorArrivalEmails(
  a: string,
  b: string,
  arrivalByEmail: Map<string, ActorCallArrival>,
): number {
  const ao = arrivalByEmail.get(a)?.offsetMin;
  const bo = arrivalByEmail.get(b)?.offsetMin;
  if (ao != null && bo != null) {
    return ao - bo || a.localeCompare(b, "ru");
  }
  if (ao != null) return -1;
  if (bo != null) return 1;
  return a.localeCompare(b, "ru");
}
