export const ACTOR_WORKBOOK_AUTOSAVE_DELAY_MS = 1200;

export type WorkbookSectionId =
  | "givenCircumstances"
  | "biography"
  | "socialPortrait"
  | "relationships"
  | "inbound"
  | "superObjective"
  | "obstacles"
  | "eventSeries"
  | "transformation"
  | "appearance"
  | "referenceImages"
  | "sceneArcs"
  | "directorQuestions"
  | "rehearsalChecklist"
  | "preparation";

export const WORKBOOK_SECTIONS: Array<{
  id: WorkbookSectionId;
  title: string;
  hint: string;
}> = [
  {
    id: "givenCircumstances",
    title: "Обстоятельства",
    hint: "Мир пьесы, время, место и правила, которые давят на героя.",
  },
  {
    id: "biography",
    title: "Биография",
    hint: "Прошлое героя и то, что сформировало его характер.",
  },
  {
    id: "socialPortrait",
    title: "Социальный портрет",
    hint: "Возраст, статус, профессия, речь, привычки и среда.",
  },
  {
    id: "relationships",
    title: "Отношения",
    hint: "Связи с другими персонажами, конфликты, близость и цели.",
  },
  {
    id: "inbound",
    title: "Обо мне",
    hint: "Что другие персонажи уже написали о вашей роли.",
  },
  {
    id: "superObjective",
    title: "Сверхзадача",
    hint: "Главная цель героя и сквозное действие.",
  },
  {
    id: "obstacles",
    title: "Препятствия",
    hint: "Что мешает герою достичь цели.",
  },
  {
    id: "eventSeries",
    title: "Событийный ряд",
    hint: "Ключевые события жизни героя в пьесе.",
  },
  {
    id: "transformation",
    title: "Трансформация",
    hint: "Кем герой был, кем стал и где случился перелом.",
  },
  {
    id: "appearance",
    title: "Внешность",
    hint: "Осанка, пластика, голос, темп и внешний образ.",
  },
  {
    id: "referenceImages",
    title: "Референсы",
    hint: "Картинки, фактуры, костюм, пластика и настроение.",
  },
  {
    id: "sceneArcs",
    title: "По сценам",
    hint: "Что меняется с персонажем в каждой сцене.",
  },
  {
    id: "directorQuestions",
    title: "Неясно",
    hint: "Вопросы режиссёру по роли, тексту и сценам.",
  },
  {
    id: "rehearsalChecklist",
    title: "Чеклист",
    hint: "Что уже отработано и что впереди.",
  },
  {
    id: "preparation",
    title: "Подготовка",
    hint: "План самостоятельной подготовки к роли.",
  },
];
