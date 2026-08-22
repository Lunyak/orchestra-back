import dayjs from "dayjs";
import type {
  PremiseBookedAsKind,
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

export function premiseBookedAsKindLabel(kind: PremiseBookedAsKind): string {
  switch (kind) {
    case "user":
      return "Пользователь";
    case "troupe":
      return "Коллектив";
    case "theater":
      return "Театр";
    case "studio":
      return "Студия";
    case "external":
      return "Внешний";
    default:
      return kind;
  }
}

export function slotBookedAs(slot: PremiseSlotItem): {
  kind: PremiseBookedAsKind;
  title: string;
} | null {
  if (!slot.rental) return null;
  const kind = slot.rental.bookedAsKind ?? "user";
  if (kind === "user") return null;
  const title = String(slot.rental.bookedAsTitle ?? "").trim();
  if (!title) return null;
  return { kind, title };
}

export function slotStatusLabel(status: PremiseSlotStatus): string {
  switch (status) {
    case "confirmed":
      return "Подтверждено";
    case "pending":
      return "Ожидает подтверждения";
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

export function decodeUploadedFileName(fileName: string): string {
  const raw = String(fileName ?? "").trim();
  if (!raw) return raw;
  const looksMojibake = /[ÐÑÃÂ]/.test(raw);
  if (!looksMojibake) return raw;
  try {
    const decoded = new TextDecoder("utf-8").decode(
      Uint8Array.from(raw, (char) => char.charCodeAt(0) & 0xff),
    );
    if (!decoded || decoded.includes("\uFFFD")) return raw;
    return decoded;
  } catch {
    return raw;
  }
}

export function agreementDocumentKindLabel(
  kind: "generated" | "uploaded" | "signed" | string,
): string {
  switch (kind) {
    case "signed":
      return "Подписанный";
    case "generated":
      return "Сформированный";
    case "uploaded":
      return "Загруженный";
    default:
      return kind;
  }
}
