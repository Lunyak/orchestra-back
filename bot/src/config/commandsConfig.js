/**
 * Единый список команд бота и их описаний.
 * Здесь можно менять короткое описание (меню) и полное (для /help).
 *
 * shortDescription — показывается в меню команд в Telegram.
 * longDescription — показывается в /help (можно писать подробнее).
 */

const COMMANDS = [
  // Команда старого формата явок (локальное хранилище в боте).
  // Сейчас репетиции создаём в Orchestra backend (через веб), а публикуем по кнопке «Опубликовать в чат».
  // {
  //   command: "setrehearsal",
  //   shortDescription: "Задать репетицию (явки)",
  //   longDescription:
  //     "Создать репетицию: дата (ДД.ММ, «завтра» или день недели) и время. После этого можно отправить опрос «Кто будет?» в группу. Доступно организатору.",
  // },
  {
    command: "register",
    shortDescription: "Зарегистрироваться",
    longDescription: "Регистрация в системе: имя, контакты, роль в театре.",
  },
  {
    command: "profile",
    shortDescription: "Просмотреть свой профиль",
    longDescription:
      "Показать или изменить свой профиль (имя, роль, контакты).",
  },
  // Google Sheets команды отключены
  // {
  //   command: "addguest",
  //   shortDescription: "Добавить зрителя на спектакль",
  //   longDescription:
  //     "Добавить гостя в выбранный список: имя, проходка, от кого, примечание.",
  // },
  // {
  //   command: "guests",
  //   shortDescription: "Показать список гостей",
  //   longDescription:
  //     "Открыть список гостей по выбранному спектаклю/дате с постраничным просмотром.",
  // },
  // {
  //   command: "newpage",
  //   shortDescription: "Новая страница гостей",
  //   longDescription:
  //     "Создать новую страницу в таблице: копия выбранного списка без гостей, с новым названием.",
  // },
  {
    command: "checkbirthdays",
    shortDescription: "Таблица дней рождения",
    longDescription:
      "Показать таблицу всех участников и их дней рождения, отсортированную от ближайшей даты к дальней.",
  },
  {
    command: "question",
    shortDescription: "Задать анонимный вопрос",
    longDescription:
      "Написать вопрос хозяину бота анонимно — ваш ник и имя не передаются.",
  },
  {
    command: "setgroup",
    shortDescription: "Задать группу для опросов (организатор)",
    longDescription:
      "Сохранить группу, куда бот будет отправлять опросы и уведомления. Отправьте /setgroup в нужной группе (бот должен быть в группе) или в личке введите ID группы. Доступно только организатору.",
    adminOnly: true,
  },
  {
    command: "who",
    shortDescription: "Кто идёт на репетицию",
    longDescription:
      "Показать явки на ближайшую репетицию: кто будет, кто не будет.",
  },
  {
    command: "remindattendance",
    shortDescription: "Напомнить о явке (организатор)",
    longDescription:
      "Вручную отправить напоминания в ЛС всем, кто ещё не отметил явку на предстоящих репетициях. Доступно только организатору.",
    adminOnly: true,
  },
  {
    command: "rehearsable",
    shortDescription: "Что можно порепетировать (организатор)",
    longDescription:
      "По заявленной явке и ролям показать, какие сцены можно провести на ближайшей репетиции. Только организатор, только в личке с ботом.",
    adminOnly: true,
  },
  {
    command: "dump",
    shortDescription: "Выгрузить дамп базы PostgreSQL (организатор)",
    longDescription:
      "Запросить у сервера дамп базы PostgreSQL и получить JSON-файл в личные сообщения — можно сохранить на рабочий стол. Доступно только организатору.",
    adminOnly: true,
  },
  {
    command: "userslist",
    shortDescription: "Таблица пользователей (организатор)",
    longDescription:
      "Показать всех зарегистрированных пользователей в виде таблицы (имя, фамилия, email, телефон, роль, день рождения, Telegram ID, роли в спектаклях). Доступно только организатору.",
    adminOnly: true,
  },
  {
    command: "leaderboard",
    shortDescription: "Лидеры викторины",
    longDescription:
      "Показать список лидеров викторины «Вопрос дня» по количеству правильных ответов. При равном счёте отображаются все с этим счётом.",
    isQuiz: true,
  },
  {
    command: "addquiz",
    shortDescription: "Добавить вопрос викторины",
    longDescription:
      "Добавить вопрос: текст, варианты ответа через запятую и правильный ответ. Участники смогут отвечать кнопками.",
    isQuiz: true,
  },
  {
    command: "callquiz",
    shortDescription: "Вызвать квиз",
    longDescription:
      "Отправить вопрос дня в группу сейчас (для тех, кто не хочет ждать следующего дня).",
    isQuiz: true,
  },
  {
    command: "quizlist",
    shortDescription: "Список вопросов викторины (ID)",
    longDescription:
      "Показать список всех вопросов викторины с ID и текстом. Чтобы удалить вопрос, используйте /deletequiz <ID> (организатор).",
    isQuiz: true,
  },
  {
    command: "deletequiz",
    shortDescription: "Удалить вопрос викторины по ID (организатор)",
    longDescription:
      "Удалить вопрос викторины по номеру ID. Список ID: /quizlist. Доступно только организатору.",
    adminOnly: true,
    isQuiz: true,
  },
  {
    command: "help",
    shortDescription: "Справка по командам",
    longDescription: "Показать список всех команд и их описание.",
  },
  {
    command: "menu",
    shortDescription: "Показать меню с кнопками",
    longDescription:
      "Показать клавиатуру с кнопками всех команд (удобно, если клавиатура была скрыта).",
  },
];

/** Подпись кнопки в главном меню, открывающей подменю викторины */
const QUIZ_SUBMENU_LABEL = "Викторина";
/** Подпись кнопки «назад» в подменю викторины */
const BACK_TO_MENU_LABEL = "Назад в меню";

module.exports = { COMMANDS, QUIZ_SUBMENU_LABEL, BACK_TO_MENU_LABEL };
