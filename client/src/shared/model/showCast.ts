export type ShowKey = "zaklyatie";

export type CastItem = {
  role: string;
  actor: string;
};

export const SHOW_CAST: Record<ShowKey, CastItem[]> = {
  zaklyatie: [
    { role: "Леон", actor: "Григорий Найденов" },
    { role: "Софья", actor: "Полина Смолкина" },
    { role: "Доктор Зубрицкий", actor: "Сергей Луняка" },
    { role: "Госпожа Зубрицкая", actor: "Анастасия Рябых" },
    { role: "Граф", actor: "Анатон Васильев" },
    { role: "Слович", actor: "Валерий Рутковский" },
    { role: "Янка", actor: "Екатерина Слыхановская" },
    { role: "Почтальон Мышкин", actor: "Алексей Филатов" },
    { role: "Снецкий", actor: "Вероника Атушева" },
    { role: "Барашек", actor: "Лера Буракова" },
  ],
};

export function getShowKeyByName(name: string | undefined | null): ShowKey | null {
  const n = (name || "").trim().toLowerCase().replace(/[.\s]+$/g, "");
  if (n === "заклятие") return "zaklyatie";
  return null;
}

