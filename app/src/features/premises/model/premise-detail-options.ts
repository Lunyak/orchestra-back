import type {
  PremiseKind,
  PremiseMemberRole,
  PremiseRecurrenceType,
  PremiseRentalItem,
  PremiseSlotPaymentStatus,
  PremiseSlotStatus,
  PremiseUsageType,
} from "../../../sync/api/premises";
import { premiseKindLabel, premiseMemberRoleLabel, slotStatusLabel } from "./premise-utils";

export const roleOptions: { value: PremiseMemberRole; label: string }[] = [
  { value: "viewer", label: premiseMemberRoleLabel("viewer") },
  { value: "tenant", label: premiseMemberRoleLabel("tenant") },
  { value: "manager", label: premiseMemberRoleLabel("manager") },
  { value: "owner", label: premiseMemberRoleLabel("owner") },
];

export const statusOptions: { value: PremiseSlotStatus; label: string }[] = [
  { value: "confirmed", label: slotStatusLabel("confirmed") },
  { value: "pending", label: slotStatusLabel("pending") },
  { value: "cancelled", label: slotStatusLabel("cancelled") },
];

export const paymentStatusOptions: {
  value: PremiseSlotPaymentStatus;
  label: string;
}[] = [
  { value: "unpaid", label: "Не оплачено" },
  { value: "paid", label: "Оплачено" },
  { value: "waived", label: "Без оплаты" },
];

export const premiseKindOptions: { value: PremiseKind; label: string }[] = [
  { value: "OWNED", label: premiseKindLabel("OWNED") },
  { value: "RENTED", label: premiseKindLabel("RENTED") },
];

export const usageTypeOptions: { value: PremiseUsageType; label: string }[] = [
  { value: "internal", label: "Своя репетиция / мероприятие" },
  { value: "friendly", label: "Бесплатная бронь" },
  { value: "commercial", label: "Коммерческая аренда" },
];

export const recurrenceTypeOptions: {
  value: PremiseRecurrenceType;
  label: string;
}[] = [
  { value: "once", label: "Разовая" },
  { value: "weekly", label: "Регулярная" },
];

export const weekDays: { weekday: number; label: string }[] = [
  { weekday: 1, label: "Понедельник" },
  { weekday: 2, label: "Вторник" },
  { weekday: 3, label: "Среда" },
  { weekday: 4, label: "Четверг" },
  { weekday: 5, label: "Пятница" },
  { weekday: 6, label: "Суббота" },
  { weekday: 0, label: "Воскресенье" },
];

export function paymentStatusLabel(status: PremiseSlotPaymentStatus): string {
  return (
    paymentStatusOptions.find((option) => option.value === status)?.label ??
    status
  );
}

export function usageTypeLabel(usageType: PremiseUsageType): string {
  return (
    usageTypeOptions.find((option) => option.value === usageType)?.label ??
    usageType
  );
}

export function rentalStatusLabel(status: PremiseRentalItem["status"]): string {
  const labels: Record<PremiseRentalItem["status"], string> = {
    pending: "Ожидает подтверждения",
    active: "Действует",
    cancelled: "Отменена",
    completed: "Завершена",
  };
  return labels[status];
}

export function agreementStatusLabel(
  status: NonNullable<PremiseRentalItem["agreement"]>["status"],
): string {
  const labels: Record<
    NonNullable<PremiseRentalItem["agreement"]>["status"],
    string
  > = {
    draft: "Черновик",
    awaiting_signature: "Ожидает подписания",
    active: "Подписан",
    terminated: "Расторгнут",
    expired: "Завершён",
  };
  return labels[status];
}
