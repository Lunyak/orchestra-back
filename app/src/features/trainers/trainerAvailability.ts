/** Тренажёры, которые пока недоступны для обычного входа (прямой URL — с предупреждением). */
export const TRAINERS_IN_DEVELOPMENT = new Set(["/trainers/speech", "/trainers/diction"]);

export function isTrainerInDevelopment(path: string): boolean {
  return TRAINERS_IN_DEVELOPMENT.has(path);
}
