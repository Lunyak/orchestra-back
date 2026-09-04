import {
  profileListAvatarSrc,
  type TeamProfile,
} from "../../../sync/api/profile";
import {
  classifyActorSlotAvailability,
  formatTimeHHMM,
  getRangesForDateMinutes,
} from "./session-page-utils";

export type IdleOrderBusyConflictSlot = {
  slotId: string;
  sceneTitle: string;
  timeFrom: string;
  timeTo: string;
};

export type IdleOrderBusyConflict = {
  email: string;
  name: string;
  avatarUrl: string | null;
  dayBusy: boolean;
  alreadyBusy: boolean;
  freeWindows: string[];
  slots: IdleOrderBusyConflictSlot[];
};

function actorLabel(profile: TeamProfile | undefined): string {
  const displayName = String(profile?.displayName ?? "").trim();
  if (displayName) return displayName;
  const firstName = String(profile?.firstName ?? "").trim();
  const lastName = String(profile?.lastName ?? "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  return fullName || "Без имени";
}

function isAbsentDay(
  profile: TeamProfile | undefined,
  dateKey: string,
): boolean {
  return profile?.availabilityCalendar?.[dateKey] === "absent";
}

export function idleOrderBusySlotLabel(slot: IdleOrderBusyConflictSlot): string {
  return `«${slot.sceneTitle}» ${slot.timeFrom}–${slot.timeTo}`;
}

export function collectIdleOrderBusyConflicts(input: {
  order: string[];
  actorsBySlotId: Record<string, string[]>;
  durationBySlotId: Record<string, number>;
  offsets: Record<string, number>;
  sessionBaseMin: number;
  sessionDateKey: string;
  profilesByEmail: Map<string, TeamProfile>;
  sceneTitleBySlotId: Record<string, string>;
}): IdleOrderBusyConflict[] {
  const byEmail = new Map<string, IdleOrderBusyConflict>();

  for (const slotId of input.order) {
    const durationMin = Math.max(
      1,
      Math.floor(Number(input.durationBySlotId[slotId]) || 1),
    );
    const startMin =
      input.sessionBaseMin + Math.max(0, Math.floor(input.offsets[slotId] ?? 0));
    const endMin = startMin + durationMin;
    const sceneTitle = input.sceneTitleBySlotId[slotId] ?? "Сцена";
    const timeFrom = formatTimeHHMM(startMin);
    const timeTo = formatTimeHHMM(endMin);

    for (const email of input.actorsBySlotId[slotId] ?? []) {
      const profile = input.profilesByEmail.get(email);
      const availability = classifyActorSlotAvailability(
        profile,
        input.sessionDateKey,
        startMin,
        endMin,
      );
      if (availability !== "busy") continue;

      const slot: IdleOrderBusyConflictSlot = {
        slotId,
        sceneTitle,
        timeFrom,
        timeTo,
      };
      const existing = byEmail.get(email);
      if (existing) {
        existing.slots.push(slot);
        continue;
      }

      const dayBusy = isAbsentDay(profile, input.sessionDateKey);
      const ranges = dayBusy
        ? []
        : getRangesForDateMinutes(profile, input.sessionDateKey);
      const freeWindows = ranges.map(
        (range) =>
          `${formatTimeHHMM(range.fromMin)}–${formatTimeHHMM(range.toMin)}`,
      );

      byEmail.set(email, {
        email,
        name: actorLabel(profile),
        avatarUrl: profileListAvatarSrc(profile),
        dayBusy,
        alreadyBusy: false,
        freeWindows,
        slots: [slot],
      });
    }
  }

  return Array.from(byEmail.values()).sort((a, b) =>
    a.email.localeCompare(b.email),
  );
}

export function annotateIdleOrderBusyConflicts(
  proposed: IdleOrderBusyConflict[],
  current: IdleOrderBusyConflict[],
): IdleOrderBusyConflict[] {
  const currentEmails = new Set(current.map((item) => item.email));
  return proposed.map((item) => ({
    ...item,
    alreadyBusy: currentEmails.has(item.email),
  }));
}

export function idleOrderHasNewBusyConflict(
  conflicts: IdleOrderBusyConflict[],
): boolean {
  return conflicts.some((item) => !item.alreadyBusy);
}

export function idleOrderBusyReason(conflict: IdleOrderBusyConflict): string {
  if (conflict.dayBusy) {
    return "В календаре занятости весь день отмечен как занятый";
  }
  if (conflict.freeWindows.length > 0) {
    return `В календаре занятости свободен только ${conflict.freeWindows.join(", ")}`;
  }
  return "В календаре занятости на это время стоит «занят»";
}

export function idleOrderBusyImpact(conflict: IdleOrderBusyConflict): string {
  const slotLabels = conflict.slots.map(idleOrderBusySlotLabel).join(", ");
  if (conflict.alreadyBusy) {
    return `Уже занят на текущем порядке. После перестановки окажется на ${slotLabels}`;
  }
  return `После перестановки окажется на ${slotLabels} — это вне свободного времени`;
}

export function idleOrderBusyLead(conflicts: IdleOrderBusyConflict[]): string {
  if (idleOrderHasNewBusyConflict(conflicts)) {
    return "Кнопка только меняет порядок сцен. Календарь занятости она не трогает. После перестановки эти люди попадают на сцену в время, когда сами отметили «занят»:";
  }
  return "Эти люди уже заняты на текущем порядке. Перестановка уменьшает простой между сценами, но не делает их свободными:";
}

export function idleOrderBusyHint(conflicts: IdleOrderBusyConflict[]): string {
  if (idleOrderHasNewBusyConflict(conflicts)) {
    return "Оставьте текущий порядок, если актёр должен быть на этих сценах. Применить можно, если репетиция без него допустима. Чтобы он пришёл — поставьте сцену в его свободное окно или попросите обновить занятость.";
  }
  return "Можно отменить или применить всё равно: занятость в календаре от порядка сцен не зависит.";
}
