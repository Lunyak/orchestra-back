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
  { id: "raw", label: "Черновик", hint: "", headerBg: "rgba(71, 85, 105, 0.55)" },
  { id: "text-learned", label: "Нужно взять", hint: "", headerBg: "rgba(30, 58, 138, 0.5)" },
  { id: "almost-ready", label: "Репетируем", hint: "", headerBg: "rgba(146, 64, 14, 0.45)" },
  { id: "ready", label: "Готова", hint: "", headerBg: "rgba(21, 128, 61, 0.45)" },
];

export function statusOf(step: ScriptStep): KanbanStatus {
  return (step.kanbanStatus ?? "raw") as KanbanStatus;
}
