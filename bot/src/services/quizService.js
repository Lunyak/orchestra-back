const cron = require("node-cron");
const axios = require("axios");
const { Markup } = require("telegraf");
const API_BASE_URL = require("../const/API_BASE_URL");
const settingsStorage = require("./settingsStorage");
const quizStateStorage = require("./quizStateStorage");
const { normalizeSupergroupId } = require("../utils/telegramUtils");

const CALLBACK_PREFIX = "quiz_btn_";
const MAX_CALLBACK_DATA = 64;

class QuizService {
  constructor(bot, userStates) {
    this.bot = bot;
    this.userStates = userStates || new Map();
    this.ownerId = process.env.OWNER_TELEGRAM_ID;
    this.baseUrl = `${API_BASE_URL}/api/quiz`;
  }

  isOwner(userId) {
    return this.ownerId && String(userId) === String(this.ownerId);
  }

  getEffectiveGroupChatId() {
    const raw = settingsStorage.getGroupChatId() || process.env.GROUP_CHAT_ID;
    return normalizeSupergroupId(raw);
  }

  /** Чат для квиза: QUIZ_GROUP_CHAT_ID или общая группа (для топика «дядо бот» задать -1494331205) */
  getQuizGroupChatId() {
    const raw =
      process.env.QUIZ_GROUP_CHAT_ID ||
      settingsStorage.getGroupChatId() ||
      process.env.GROUP_CHAT_ID;
    return normalizeSupergroupId(raw);
  }

  /** ID топика для сообщений квиза (вопрос дня, эффекты). Пример: 39822 для топика «дядо бот» */
  getQuizThreadId() {
    return (
      process.env.QUIZ_THREAD_ID ||
      settingsStorage.getAttendanceThreadId() ||
      process.env.GROUP_CHAT_ID_ATTENTION ||
      process.env.ATTENDANCE_THREAD_ID
    );
  }

  /** Отправить сообщение пользователю в личку (ответ по квизу). При ошибке (бот не запущен у пользователя) — не падаем */
  async _sendQuizFeedbackToUser(userId, text) {
    try {
      await this.bot.telegram.sendMessage(userId, text);
    } catch (e) {
      if (e?.response?.description)
        console.warn("Quiz feedback to LS:", e.response.description);
    }
  }

  async fetchTodayQuestion() {
    const { data } = await axios.get(`${this.baseUrl}/today`, {
      timeout: 10000,
      validateStatus: (s) => s === 200,
    });
    return data;
  }

  /** Следующий вопрос (каждый раз новый из редко использованных) — для «Вызвать квиз» */
  async fetchNextQuestion() {
    const { data } = await axios.get(`${this.baseUrl}/next`, {
      timeout: 10000,
      validateStatus: (s) => s === 200,
    });
    return data;
  }

  async fetchQuestionById(questionId) {
    const { data } = await axios.get(`${this.baseUrl}/question/${questionId}`, {
      timeout: 10000,
      validateStatus: (s) => s === 200,
    });
    return data;
  }

  async fetchRandomQuestion() {
    const { data } = await axios.get(`${this.baseUrl}/random`, {
      timeout: 10000,
      validateStatus: (s) => s === 200,
    });
    return data;
  }

  async submitAnswer(questionId, userTelegramId, userName, answer) {
    const { data } = await axios.post(
      `${this.baseUrl}/answer`,
      {
        questionId,
        userTelegramId: String(userTelegramId),
        userName: userName || "Участник",
        answer,
      },
      { timeout: 10000, validateStatus: (s) => s === 200 || s === 201 },
    );
    return data;
  }

  async fetchLeaderboard() {
    const { data } = await axios.get(`${this.baseUrl}/leaderboard`, {
      timeout: 10000,
      validateStatus: (s) => s === 200,
    });
    return data;
  }

  async createQuestion(text, correctAnswer, options = []) {
    await axios.post(
      `${this.baseUrl}/questions`,
      {
        text: text.trim(),
        correctAnswer: correctAnswer.trim(),
        options: Array.isArray(options)
          ? options.map((o) => String(o).trim()).filter(Boolean)
          : [],
      },
      { timeout: 10000, validateStatus: (s) => s === 201 || s === 200 },
    );
  }

  async fetchAllQuestions() {
    const { data } = await axios.get(`${this.baseUrl}/questions`, {
      timeout: 10000,
      validateStatus: (s) => s === 200,
    });
    return data;
  }

  async deleteQuestionById(id) {
    await axios.delete(`${this.baseUrl}/question/${id}`, {
      timeout: 10000,
      validateStatus: (s) => s === 200,
    });
  }

  /** Собрать клавиатуру из вариантов (перемешиваем порядок, в callback — исходный индекс) */
  buildOptionsKeyboard(questionId, options) {
    if (!options || options.length === 0) return null;
    const indices = options.map((_, i) => i).sort(() => Math.random() - 0.5);
    const buttons = indices.map((origIdx) => {
      const text = String(options[origIdx]).slice(0, 40);
      const data = `${CALLBACK_PREFIX}${questionId}_${origIdx}`;
      return [
        Markup.button.callback(
          text,
          data.length <= MAX_CALLBACK_DATA
            ? data
            : `${CALLBACK_PREFIX}${questionId}_0`,
        ),
      ];
    });
    return Markup.inlineKeyboard(buttons);
  }

  /** Отправить один вопрос в топик квиза и сохранить в state (для ответов) */
  async _sendQuestionToGroup(question) {
    const chatId = this.getQuizGroupChatId();
    if (!chatId) return;
    const today = new Date().toISOString().slice(0, 10);
    const hasOptions = question.options && question.options.length > 0;
    const text = hasOptions
      ? `🎭 Вопрос дня (театр)\n\n${question.text}`
      : `🎭 Вопрос дня (театр)\n\n${question.text}\n\nОтветьте на это сообщение своим вариантом ответа.`;
    const keyboard = hasOptions
      ? this.buildOptionsKeyboard(question.id, question.options)
      : null;
    const threadId = this.getQuizThreadId();
    const sent = await this.bot.telegram.sendMessage(chatId, text, {
      message_thread_id: threadId ? parseInt(threadId, 10) : undefined,
      ...(keyboard ? keyboard : {}),
    });
    const chatIdForState = String(chatId).startsWith("-100")
      ? String(chatId)
      : `-100${String(chatId).replace(/^-?/, "")}`;
    quizStateStorage.setTodayQuestionMessage(
      chatIdForState,
      sent.message_id,
      question.id,
      today,
    );
  }

  /** Раз в день отправить вопрос в группу (крон 10:00; кэш «на сегодня») */
  async sendDailyQuestion() {
    const chatId = this.getQuizGroupChatId();
    if (!chatId) {
      console.warn("Quiz: группа не задана, пропуск вопроса дня.");
      return;
    }
    try {
      const question = await this.fetchTodayQuestion();
      if (!question || !question.id) {
        const threadId = this.getQuizThreadId();
        await this.bot.telegram.sendMessage(
          chatId,
          "На сегодня вопросов нет. Добавьте вопросы через /addquiz.",
          { message_thread_id: threadId ? parseInt(threadId, 10) : undefined },
        );
        return;
      }
      await this._sendQuestionToGroup(question);
    } catch (e) {
      console.error("Quiz: ошибка отправки вопроса дня:", e.message || e);
    }
  }

  /** Анимация при правильном ответе — в топик квиза (напр. «дядо бот») */
  async _sendCorrectAnswerEffect(ctx) {
    try {
      const chatId = this.getQuizGroupChatId();
      const threadId = this.getQuizThreadId();
      const opts =
        threadId != null && threadId !== ""
          ? { message_thread_id: parseInt(threadId, 10) }
          : {};
      await this.bot.telegram.sendDice(chatId, { emoji: "🎯", ...opts });
    } catch (e) {
      // не ломаем ответ из-за эффекта
      if (e?.response?.description)
        console.warn("Quiz effect:", e.response.description);
    }
  }

  /** Обработка нажатия кнопки с вариантом ответа (quiz_btn_{questionId}_{optionIndex}) */
  async handleQuizButton(ctx) {
    const match = ctx.match || [];
    const questionId = parseInt(match[1], 10);
    const optionIndex = parseInt(match[2], 10);
    if (!questionId || isNaN(optionIndex)) return false;

    try {
      const question = await this.fetchQuestionById(questionId);
      if (
        !question ||
        !question.options ||
        optionIndex < 0 ||
        optionIndex >= question.options.length
      ) {
        await ctx.answerCbQuery("Вариант не найден.");
        return true;
      }
      const answerText = question.options[optionIndex];
      const userId = ctx.from.id;
      const userName = ctx.from.first_name || ctx.from.username || "Участник";
      const result = await this.submitAnswer(
        questionId,
        userId,
        userName,
        answerText,
      );
      const emoji = result.correct ? "✅" : "❌";
      const msg = result.correct
        ? `${emoji} Верно! Ваш счёт: ${result.totalPoints}`
        : `${emoji} Неверно. Ваш счёт: ${result.totalPoints} (неправильные ответы очки не снимают)`;
      await ctx.answerCbQuery();
      if (result.correct) await this._sendCorrectAnswerEffect(ctx);
      await this._sendQuizFeedbackToUser(userId, msg);
    } catch (e) {
      await ctx.answerCbQuery("Ошибка").catch(() => {});
      await this._sendQuizFeedbackToUser(
        ctx.from?.id,
        "Не удалось засчитать ответ.",
      );
      console.error("Quiz button:", e.message || e);
    }
    return true;
  }

  /** Обработка ответа на сообщение с вопросом (когда вариантов нет — ответ текстом) */
  async handleQuizReply(ctx) {
    const replyTo = ctx.message?.reply_to_message;
    if (!replyTo || !replyTo.text || !ctx.message?.text) return false;

    const state = quizStateStorage.getTodayQuestionMessage();
    if (!state) return false;
    const chatIdNorm = normalizeSupergroupId(String(ctx.chat.id));
    const stateChatIdNorm = normalizeSupergroupId(state.chatId);
    const sameChat =
      chatIdNorm === stateChatIdNorm ||
      (chatIdNorm &&
        stateChatIdNorm &&
        chatIdNorm === `-100${stateChatIdNorm}`);
    if (!sameChat) return false;
    if (replyTo.message_id !== state.messageId) return false;

    const userId = ctx.from.id;
    const userName = ctx.from.first_name || ctx.from.username || "Участник";
    const answer = ctx.message.text.trim();
    if (!answer) return false;

    try {
      const result = await this.submitAnswer(
        state.questionId,
        userId,
        userName,
        answer,
      );
      const emoji = result.correct ? "✅" : "❌";
      const msg = result.correct
        ? `${emoji} Верно! Ваш счёт: ${result.totalPoints}`
        : `${emoji} Неверно. Ваш счёт: ${result.totalPoints} (неправильные ответы очки не снимают)`;
      if (result.correct) await this._sendCorrectAnswerEffect(ctx);
      await this._sendQuizFeedbackToUser(userId, msg);
    } catch (e) {
      await this._sendQuizFeedbackToUser(
        userId,
        "Не удалось засчитать ответ. Попробуйте позже.",
      );
      console.error("Quiz submit answer:", e.message || e);
    }
    return true;
  }

  /** Команда /leaderboard */
  async showLeaderboard(ctx) {
    try {
      const list = await this.fetchLeaderboard();
      if (!list || list.length === 0) {
        return ctx.reply("Пока ни одного ответа. Участвуйте во «Вопросе дня»!");
      }

      const maxPoints = list[0]?.correctCount ?? 0;
      const leaders = list.filter((u) => u.correctCount === maxPoints);
      const lines = [
        "🏆 Лидеры викторины (по количеству правильных ответов):",
        "",
        ...leaders.map(
          (u, i) =>
            `${i + 1}. ${u.userName} — ${u.correctCount} ${plural(u.correctCount)}`,
        ),
      ];
      if (list.length > leaders.length) {
        lines.push("");
        lines.push("Остальные участники:");
        list
          .filter((u) => u.correctCount < maxPoints)
          .forEach((u, i) => {
            lines.push(
              `${leaders.length + i + 1}. ${u.userName} — ${u.correctCount} ${plural(u.correctCount)}`,
            );
          });
      }
      await ctx.reply(lines.join("\n"));
    } catch (e) {
      await ctx.reply("Не удалось загрузить список лидеров.");
      console.error("Quiz leaderboard:", e.message || e);
    }
  }

  /** Команда /quizlist — список вопросов с ID */
  async showQuizList(ctx) {
    try {
      const list = await this.fetchAllQuestions();
      if (!list || list.length === 0) {
        return ctx.reply("В базе пока нет вопросов. Добавьте через /addquiz.");
      }
      const lines = list.map((q) => {
        const short = (q.text || "").slice(0, 80);
        const suffix = (q.text || "").length > 80 ? "…" : "";
        return `${q.id}. ${short}${suffix}`;
      });
      await ctx.reply(
        "Вопросы викторины (ID и текст):\n\n" + lines.join("\n\n"),
      );
    } catch (e) {
      await ctx.reply("Не удалось загрузить список вопросов.");
      console.error("Quiz list:", e.message || e);
    }
  }

  /** Команда /deletequiz — удаление вопроса по ID (только организатор) */
  startDeleteQuiz(ctx) {
    if (!this.isOwner(ctx.from.id)) {
      return ctx.reply("Эта команда доступна только организатору.");
    }
    this.userStates.set(ctx.from.id, {
      step: "deletequiz_wait_id",
      data: {},
    });
    ctx.reply(
      "Введите ID вопроса для удаления (список: /quizlist). Отмена: /cancel",
    );
  }

  /** Обработка ввода ID в потоке /deletequiz */
  async handleDeleteQuizMessage(ctx) {
    const userId = ctx.from?.id;
    const state = this.userStates.get(userId);
    if (!state || state.step !== "deletequiz_wait_id") return false;

    const text = (ctx.message?.text || "").trim();
    if (/^\/cancel$/i.test(text)) {
      this.userStates.delete(userId);
      await ctx.reply("Удаление вопроса отменено.");
      return true;
    }

    const id = parseInt(text, 10);
    if (Number.isNaN(id) || id < 1) {
      await ctx.reply(
        "Введите число — ID вопроса (например 5). Список: /quizlist",
      );
      return true;
    }

    this.userStates.delete(userId);
    try {
      await this.deleteQuestionById(id);
      await ctx.reply(`Вопрос с ID ${id} удалён.`);
    } catch (e) {
      const msg =
        e.response?.status === 404
          ? "Вопрос не найден."
          : e.message || "Не удалось удалить вопрос.";
      await ctx.reply(msg);
    }
    return true;
  }

  /** Команда /addquiz — загрузка вопроса (любой пользователь) */
  startAddQuiz(ctx) {
    this.userStates.set(ctx.from.id, {
      step: "addquiz_text",
      data: {},
    });
    ctx.reply("Введите текст вопроса (одним сообщением). Отмена: /cancel");
  }

  /** Команда /callquiz — отправить новый вопрос в топик квиза (каждый раз другой из редко использованных) */
  async startCallQuiz(ctx) {
    const chatId = this.getQuizGroupChatId();
    if (!chatId) {
      return ctx.reply(
        "Группа для опросов не задана. Организатор может задать её через «Задать группу для опросов».",
      );
    }
    try {
      await ctx.reply("Отправляю вопрос в группу…");
      const question = await this.fetchNextQuestion();
      if (!question || !question.id) {
        return ctx.reply("Нет вопросов в базе. Добавьте через /addquiz.");
      }
      await this._sendQuestionToGroup(question);
      await ctx.reply("Готово. Вопрос отправлен в группу.");
    } catch (e) {
      await ctx.reply("Не удалось отправить вопрос в группу.");
      console.error("Quiz call:", e.message || e);
    }
  }

  /** Обработка шагов /addquiz (вызывается из middleware) */
  async handleAddQuizMessage(ctx) {
    const userId = ctx.from?.id;
    const state = this.userStates.get(userId);
    if (!state || !state.step?.startsWith("addquiz_")) return false;

    const text = (ctx.message?.text || "").trim();
    if (/^\/cancel$/i.test(text)) {
      this.userStates.delete(userId);
      await ctx.reply("Добавление вопроса отменено.");
      return true;
    }

    if (state.step === "addquiz_text") {
      state.data.text = text;
      state.step = "addquiz_options";
      this.userStates.set(userId, state);
      await ctx.reply(
        "Введите варианты ответа через запятую (один из них будет правильным). Или напишите один вариант, если ответ текстом:",
      );
      return true;
    }

    if (state.step === "addquiz_options") {
      const options = text
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      state.data.options = options;
      state.step = "addquiz_answer";
      this.userStates.set(userId, state);
      await ctx.reply(
        options.length > 0
          ? "Введите правильный ответ (точно как один из вариантов):"
          : "Введите правильный ответ (одним сообщением):",
      );
      return true;
    }

    if (state.step === "addquiz_answer") {
      this.userStates.delete(userId);
      try {
        await this.createQuestion(
          state.data.text,
          text,
          state.data.options || [],
        );
        await ctx.reply("Вопрос добавлен в базу.");
      } catch (e) {
        await ctx.reply(
          `Ошибка: ${e.message || "не удалось сохранить вопрос"}.`,
        );
      }
      return true;
    }

    return false;
  }

  middleware() {
    return async (ctx, next) => {
      if (ctx.message?.text === undefined) return next();
      if (ctx.chat?.type === "private") {
        const handledDelete = await this.handleDeleteQuizMessage(ctx);
        if (handledDelete) return;
        const handled = await this.handleAddQuizMessage(ctx);
        if (handled) return;
      }
      return next();
    };
  }

  init() {
    this.bot.use(this.middleware());

    this.bot.command("leaderboard", (ctx) => this.showLeaderboard(ctx));
    this.bot.command("addquiz", (ctx) => this.startAddQuiz(ctx));
    this.bot.command("callquiz", (ctx) => this.startCallQuiz(ctx));
    this.bot.command("quizlist", (ctx) => this.showQuizList(ctx));
    this.bot.command("deletequiz", (ctx) => this.startDeleteQuiz(ctx));

    this.bot.action(/^quiz_btn_(\d+)_(\d+)$/, async (ctx) => {
      await this.handleQuizButton(ctx);
    });

    this.bot.on("message", async (ctx, next) => {
      const handled = await this.handleQuizReply(ctx);
      if (handled) return;
      return next();
    });

    cron.schedule("0 10 * * *", () => this.sendDailyQuestion(), {
      timezone: "Europe/Moscow",
    });

    console.log(
      "Сервис викторины (вопрос дня + лидерборд + тест) инициализирован.",
    );
  }
}

function plural(n) {
  if (n === 1) return "балл";
  if (n >= 2 && n <= 4) return "балла";
  return "баллов";
}

module.exports = { QuizService };
