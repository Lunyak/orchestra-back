const actionHandlers = require("./callbacks");
const {
  getGuestsApi,
  addGuest,
  createSheetFromTemplate,
  getSpreadsheet,
} = require("./googleSheets");
const messageEvents = require("./massegeEvents");

class GoogleSheetsService {
  constructor(bot, userStates) {
    this.bot = bot;
    this.userStates = userStates;
  }

  async startGetList(ctx) {
    if (ctx.chat?.type !== "private") {
      return ctx.reply(
        "Список гостей — только в личных сообщениях. Откройте бота и нажмите «Написать».",
      );
    }
    const userId = ctx.from.id;

    try {
      const { sheets } = await getSpreadsheet();
      const sheetNames = sheets.map((s) => s.title);

      if (sheetNames.length === 0) {
        await ctx.reply("В таблице нет листов.");
        return;
      }

      this.userStates.set(userId, {
        step: "getlist_select_sheet",
        sheetNames,
      });

      // Кнопки по 2 в ряд
      const keyboard = { inline_keyboard: [] };
      for (let i = 0; i < sheetNames.length; i += 2) {
        const row = [{ text: sheetNames[i], callback_data: `getlist_${i}` }];
        if (i + 1 < sheetNames.length) {
          row.push({
            text: sheetNames[i + 1],
            callback_data: `getlist_${i + 1}`,
          });
        }
        keyboard.inline_keyboard.push(row);
      }

      await ctx.reply("Выберите список гостей:", { reply_markup: keyboard });
    } catch (error) {
      console.error(error);
      await ctx.reply("Ошибка при загрузке списка листов.");
    }
  }

  async getList(ctx, sheetName) {
    try {
      // Get data from the sheet
      const guestsData = await getGuestsApi(sheetName);

      // Store the data in user state
      this.userStates.set("googlSheets", {
        currentPage: 0,
        guestsData: guestsData,
      });

      // Send first page
      await this.sendPage(ctx, 0);
    } catch (error) {
      console.log(error);
      ctx.reply("Ошибка при получении данных гостей.");
    }
  }

  async sendPage(ctx, page) {
    const pageSize = 30; // Количество записей на странице
    const state = this.userStates.get("googlSheets");
    const guestsData = state?.guestsData || [];

    const start = page * pageSize;
    const end = start + pageSize;
    const pageData = guestsData.slice(start, end);

    if (pageData.length === 0) {
      await ctx.reply("Нет данных для отображения.");
      return;
    }

    // Формируем заголовок таблицы
    const header =
      `<b>Наполненность зала</b>\n` +
      `<code>----------------------------------------------------</code>`;

    // Формируем строки таблицы
    const rows = pageData
      .map((row, index) => {
        const num = (start + index + 1).toString().padEnd(3); // Номер строки
        const guest = (row[0] || "-").padEnd(0); // Гость
        const pass = (row[1] || "-").padEnd(0); // Проходка
        const from = (row[2] || "-").padEnd(0); // От кого
        const note = (row[3] || "-").padEnd(0); // Примечание
        return `<code>${num} <b>${guest}</b> ${pass} ${from} ${note}</code>`;
      })
      .join("\n");

    // Формируем клавиатуру для навигации
    const keyboard = {
      inline_keyboard: [],
    };

    // Добавляем кнопку "Назад", если это не первая страница
    if (page > 0) {
      keyboard.inline_keyboard.push([
        {
          text: "⬅️ Назад",
          callback_data: `page_${page - 1}`,
        },
      ]);
    }

    // Добавляем кнопку "Вперед", если это не последняя страница
    if (end < guestsData.length) {
      keyboard.inline_keyboard.push([
        {
          text: "Вперед ➡️",
          callback_data: `page_${page + 1}`,
        },
      ]);
    }

    // Отправляем сообщение с клавиатурой
    await ctx.reply(rows, { reply_markup: keyboard, parse_mode: "HTML" });
  }

  // Инициализация команды /addguest
  async initGuestCommands(ctx) {
    if (ctx.chat?.type !== "private") {
      return ctx.reply(
        "Добавление гостя — только в личных сообщениях. Откройте бота и нажмите «Написать».",
      );
    }
    const userId = ctx.from.id;

    try {
      const { sheets } = await getSpreadsheet();
      const sheetNames = sheets.map((s) => s.title);

      if (sheetNames.length === 0) {
        ctx.reply("В таблице нет листов.");
        return;
      }

      this.userStates.set(userId, {
        step: "addguest_select_sheet",
        data: {},
        sheetNames,
      });

      const keyboard = { inline_keyboard: [] };
      for (let i = 0; i < sheetNames.length; i += 2) {
        const row = [{ text: sheetNames[i], callback_data: `addguest_${i}` }];
        if (i + 1 < sheetNames.length) {
          row.push({
            text: sheetNames[i + 1],
            callback_data: `addguest_${i + 1}`,
          });
        }
        keyboard.inline_keyboard.push(row);
      }

      await ctx.reply("Выберите список, куда добавить гостя:", {
        reply_markup: keyboard,
      });
    } catch (error) {
      console.error(error);
      ctx.reply("Ошибка при загрузке списка листов.");
    }
  }

  async addGuestHendler(ctx, state, userId) {
    const guestData = [
      state.data.name, // Гость
      state.data.pass, // Проходка
      state.data.from, // От кого
      state.data.note, // Примечание
    ];

    const sheetName = state.sheetName;

    // Записываем данные в Google Таблицу
    addGuest(guestData, sheetName).then((success) => {
      if (success) {
        ctx.reply("Гость успешно добавлен в таблицу!");
      } else {
        ctx.reply("Произошла ошибка при добавлении гостя.");
      }
    });

    // Очищаем состояние
    this.userStates.delete(userId);
  }

  // Команда создания новой страницы для гостей
  initNewPageCommands(ctx) {
    if (ctx.chat?.type !== "private") {
      return ctx.reply(
        "Новая страница гостей — только в личных сообщениях. Откройте бота и нажмите «Написать».",
      );
    }
    const userId = ctx.from.id;

    this.userStates.set(userId, {
      step: "newpage_select_play",
      data: {},
    });

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "Васса Железнова",
            callback_data: "newpage_Васса_Железнова",
          },
          {
            text: "Куличевское заклятие",
            callback_data: "newpage_Куличевское_заклятие",
          },
        ],
      ],
    };

    ctx.reply("Выберите спектакль (будет скопирована его страница гостей):", {
      reply_markup: keyboard,
    });
  }

  async createNewPageHandler(ctx, state, userId) {
    const sheetName =
      state.play === "Васса_Железнова" ? "Васса 08.05.25" : "Дураки 02.05.25";
    const newSheetName = state.data.newSheetName.trim();

    if (!newSheetName) {
      ctx.reply("Название страницы не может быть пустым.");
      this.userStates.delete(userId);
      return;
    }

    try {
      await createSheetFromTemplate(sheetName, newSheetName);
      ctx.reply(
        `Страница «${newSheetName}» создана: скопирована с «${sheetName}», список гостей очищен.`,
      );
    } catch (error) {
      console.error(error);
      ctx.reply(
        "Ошибка при создании страницы. Проверьте название и доступ к таблице.",
      );
    }

    this.userStates.delete(userId);
  }

  initMessageHendlers() {
    const GoogleSheetsMiddleware = messageEvents(this);
    this.bot.use(GoogleSheetsMiddleware);
  }

  init() {
    this.initMessageHendlers();
    actionHandlers(this);
  }
}

module.exports = GoogleSheetsService;
