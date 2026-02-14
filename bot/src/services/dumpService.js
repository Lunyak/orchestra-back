const axios = require("axios");
const API_BASE_URL = require("../const/API_BASE_URL");

/**
 * Сервис выгрузки дампа PostgreSQL через API сервера.
 * Команда /dump доступна только владельцу (OWNER_TELEGRAM_ID).
 * Бот запрашивает GET /api/dump с секретом и отправляет файл в Telegram — можно сохранить на рабочий стол.
 */
class DumpService {
  constructor(bot) {
    this.bot = bot;
    this.ownerId = process.env.OWNER_TELEGRAM_ID;
    this.dumpSecret = process.env.DUMP_SECRET;
    this.dumpUrl = `${API_BASE_URL}/api/dump`;
  }

  isOwner(userId) {
    return this.ownerId && String(userId) === String(this.ownerId);
  }

  /**
   * Запросить дамп у сервера (PostgreSQL).
   */
  async fetchDumpFromApi() {
    if (!this.dumpSecret) {
      throw new Error(
        "DUMP_SECRET не задан в .env бота (должен совпадать с сервером).",
      );
    }
    const { data } = await axios.get(this.dumpUrl, {
      headers: { "X-Dump-Secret": this.dumpSecret },
      timeout: 30000,
      validateStatus: (status) => status === 200,
    });
    return data;
  }

  /**
   * Отправить дамп владельцу в Telegram (файл можно сохранить на рабочий стол).
   */
  async sendDumpToOwner(ctx) {
    const userId = ctx.from?.id;
    if (!this.isOwner(userId)) {
      await ctx.reply("Эта команда доступна только организатору.");
      return;
    }

    try {
      await ctx.reply("Запрашиваю дамп из базы PostgreSQL…");
      const dump = await this.fetchDumpFromApi();
      const json = JSON.stringify(dump, null, 2);
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const filename = `dump-postgres-${timestamp}.json`;

      await ctx.telegram.sendDocument(userId, {
        source: Buffer.from(json, "utf8"),
        filename,
      });
      await ctx.reply(
        "Дамп базы отправлен в личные сообщения. Сохраните файл на рабочий стол при необходимости.",
      );
    } catch (error) {
      const msg =
        error.response?.status === 401
          ? "Неверный DUMP_SECRET или он не задан на сервере."
          : error.response?.data?.message ||
            error.message ||
            "неизвестная ошибка";
      console.error("Ошибка при выгрузке дампа:", error.message || error);
      await ctx.reply(`Не удалось выгрузить дамп: ${msg}`);
    }
  }

  init() {
    this.bot.command("dump", (ctx) => this.sendDumpToOwner(ctx));
    console.log(
      "Сервис дампа PostgreSQL инициализирован (/dump → API сервера).",
    );
  }
}

module.exports = { DumpService };
