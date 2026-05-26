import type { ScriptStep } from "../../types/script";

export type KanbanStatus = NonNullable<ScriptStep["kanbanStatus"]>;

export type KanbanStatusConfig = {
  id: KanbanStatus;
  label: string;
  hint: string;
  /** Фон шапки колонки (любой валидный CSS color). */
  headerBg: string;
};

export const STATUSES: KanbanStatusConfig[] = [
  { id: "raw", label: "Черновик", hint: "", headerBg: "var(--kanban-col-raw)" },
  { id: "text-learned", label: "Нужно взять", hint: "", headerBg: "var(--kanban-col-text-learned)" },
  { id: "almost-ready", label: "Репетируем", hint: "", headerBg: "var(--kanban-col-almost-ready)" },
  { id: "ready", label: "Готова", hint: "", headerBg: "var(--kanban-col-ready)" },
];

export function statusOf(step: ScriptStep): KanbanStatus {
  return (step.kanbanStatus ?? "raw") as KanbanStatus;
}
