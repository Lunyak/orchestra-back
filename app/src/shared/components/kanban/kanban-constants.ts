import type { ScriptScene } from "../../types/script";

export type KanbanStatus = NonNullable<ScriptScene["kanbanStatus"]>;

export type KanbanStatusConfig = {
  id: KanbanStatus;
  label: string;
  hint: string;
  /** CSS-модификатор акцента колонки/карточки. */
  statusClass: string;
};

export const STATUSES: KanbanStatusConfig[] = [
  { id: "raw", label: "Черновик", hint: "", statusClass: "kanban-status--raw" },
  {
    id: "text-learned",
    label: "Нужно взять",
    hint: "",
    statusClass: "kanban-status--text-learned",
  },
  {
    id: "almost-ready",
    label: "Репетируем",
    hint: "",
    statusClass: "kanban-status--almost-ready",
  },
  { id: "ready", label: "Готова", hint: "", statusClass: "kanban-status--ready" },
];

export function statusOf(scene: ScriptScene): KanbanStatus {
  return (scene.kanbanStatus ?? "raw") as KanbanStatus;
}
