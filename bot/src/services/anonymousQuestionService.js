/**
 * Анонимные вопросы хозяину бота.
 * В .env нужен OWNER_TELEGRAM_ID — id аккаунта, которому приходят вопросы.
 */

class AnonymousQuestionService {
  constructor(bot, userStates) {
    this.bot = bot;
    this.userStates = userStates;
    this.ownerId = process.env.OWNER_TELEGRAM_ID;
  }

  async initQuestion(ctx) {
    const userId = ctx.from?.id;
    if (!userId) return;
    if (ctx.chat?.type !== "private") {
      await ctx.reply(
        "Анонимный вопрос — только в личных сообщениях. Откройте бота и нажмите «Написать».",
      );
      return;
    }
    if (!this.ownerId) {
      await ctx.reply("Функция вопросов временно недоступна.");
      return;
    }

    try {
      this.userStates.set(userId, { step: "anonymous_question" });
      await ctx.reply(
        "Напишите ваш вопрос. Он будет передан хозяину бота анонимно — ваш ник и имя не показываются.",
      );
    } catch (err) {
      console.error("Ошибка при инициализации анонимного вопроса:", err);
      try {
        await ctx.reply("Не удалось отправить сообщение. Попробуйте позже.");
      } catch (_) {}
    }
  }

  async handleQuestionText(ctx) {
    if (ctx.chat?.type !== "private") return false;
    const userId = ctx.from.id;
    const state = this.userStates.get(userId);

    if (!state || state.step !== "anonymous_question") {
      return false;
    }

    const text = (ctx.message?.text || "").trim();
    if (!text) {
      ctx.reply(
        "Вопрос не может быть пустым. Напишите текст или отмените: /question",
      );
      return true;
    }

    this.userStates.delete(userId);

    try {
      await ctx.telegram.sendMessage(
        this.ownerId,
        `Анонимный вопрос:\n\n${text}`,
      );
      await ctx.reply("Спасибо, ваш вопрос отправлен.");
    } catch (err) {
      console.error("Ошибка отправки анонимного вопроса:", err);
      await ctx.reply("Не удалось отправить вопрос. Попробуйте позже.");
    }

    return true;
  }

  middleware() {
    return async (ctx, next) => {
      if (ctx.message?.text === undefined) return next();

      const handled = await this.handleQuestionText(ctx);
      if (handled) return;
      return next();
    };
  }

  init() {
    this.bot.use(this.middleware());
  }
}

module.exports = AnonymousQuestionService;
