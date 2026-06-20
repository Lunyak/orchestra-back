export const PROJECT_TASK_STATUS_LABELS = {
  todo: "К выполнению",
  in_progress: "В работе",
  done: "Готово",
  blocked: "Заблокировано",
} as const;

export const PROJECT_TASK_CATEGORY_LABELS = {
  props: "Реквизит",
  costume: "Костюм",
  light: "Свет",
  sound: "Звук",
  admin: "Админ",
  production: "Производство",
  other: "Другое",
} as const;

export type ProjectTaskFilter = "all" | "mine" | "open";

export function isProjectTaskOpen(status: string): boolean {
  return status === "todo" || status === "in_progress" || status === "blocked";
}

export function formatProjectTaskDueDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function isProjectTaskOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}
