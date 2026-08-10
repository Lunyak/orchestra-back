import dayjs from "dayjs";
import type {
  PremiseKind,
  PremiseMemberRole,
  PremiseSlotItem,
  PremiseSlotStatus,
} from "../../../sync/api/premises";

export function premiseKindLabel(kind: PremiseKind): string {
  return kind === "OWNED" ? "Своё" : "Снимаем";
}

export function premiseMemberRoleLabel(role: PremiseMemberRole): string {
  switch (role) {
    case "owner":
      return "Хозяин";
    case "manager":
      return "Менеджер";
    case "tenant":
      return "Арендатор";
    case "viewer":
      return "Наблюдатель";
    default:
      return role;
  }
}

export function slotStatusLabel(status: PremiseSlotStatus): string {
  switch (status) {
    case "confirmed":
      return "Подтверждено";
    case "pending":
      return "Ожидает";
    case "cancelled":
      return "Отменено";
    default:
      return status;
  }
}

export function isoDate(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
}

export function monthKey(d: Date): string {
  return dayjs(d).format("YYYY-MM");
}

export function formatSlotTime(slot: PremiseSlotItem): string {
  const start = dayjs(slot.startsAt);
  const end = start.add(slot.durationMin, "minute");
  return `${start.format("DD.MM.YYYY HH:mm")} – ${end.format("HH:mm")}`;
}

export function slotsForDay(
  slots: PremiseSlotItem[],
  dayIso: string,
): PremiseSlotItem[] {
  return slots.filter((s) => dayjs(s.startsAt).format("YYYY-MM-DD") === dayIso);
}

export function slotDotsByDate(slots: PremiseSlotItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const slot of slots) {
    if (slot.status === "cancelled") continue;
    const day = dayjs(slot.startsAt).format("YYYY-MM-DD");
    out[day] = (out[day] ?? 0) + 1;
  }
  return out;
}

export function monthRangeIso(month: Date): { from: string; to: string } {
  const start = dayjs(month).startOf("month");
  const end = dayjs(month).endOf("month");
  return {
    from: start.toISOString(),
    to: end.endOf("day").toISOString(),
  };
}

export function toDatetimeLocalValue(iso: string): string {
  return dayjs(iso).format("YYYY-MM-DDTHH:mm");
}

export function fromDatetimeLocalValue(value: string): string {
  return dayjs(value).toISOString();
}
