/** Тренажёры, которые пока недоступны для обычного входа (прямой URL — с предупреждением). */
export const TRAINERS_IN_DEVELOPMENT = new Set([
  "/trainers/speech",
  "/trainers/diction",
]);

export const READY_TRAINERS = [
  {
    title: "Учить текст роли",
    description: "Тренажёр по репликам выбранной роли (диалог, карточки, голос).",
    path: "/actor",
  },
] as const;

export function isTrainerInDevelopment(path: string): boolean {
  return TRAINERS_IN_DEVELOPMENT.has(path);
}
