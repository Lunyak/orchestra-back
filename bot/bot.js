require("dotenv").config();
const http = require("http");
const { Telegraf, Markup } = require("telegraf");
const {
  COMMANDS,
  QUIZ_SUBMENU_LABEL,
  BACK_TO_MENU_LABEL,
} = require("./src/config/commandsConfig");

// Инициализация бота
const bot = new Telegraf(process.env.BOT_TOKEN);

const HEALTH_PORT = Number(process.env.HEALTH_PORT) || 3001;

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error("Payload too large"));
        try {
          req.destroy();
        } catch {}
      }
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function startHttpServer({
  onPublishRehearsal,
  onPublishDirectorSession,
  onRemindDirectorSessionAvailability,
}) {
  if (String(process.env.DISABLE_INTERNAL_HTTP || "").trim() === "1") {
    return;
  }
  http
    .createServer(async (req, res) => {
      try {
        const url = req.url || "/";
        const method = (req.method || "GET").toUpperCase();

        if (url === "/health" || url === "/") {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("ok");
          return;
        }

        if (url === "/internal/publish-rehearsal" && method === "POST") {
          const secret = process.env.INTERNAL_API_SECRET;
          const got = req.headers["x-internal-secret"];
          if (!secret || String(got || "") !== String(secret)) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
            return;
          }

          const body = await readJson(req);
          const rehearsalId = String(body?.rehearsalId || "").trim();
          if (!rehearsalId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "rehearsalId is required" }));
            return;
          }

          try {
            await onPublishRehearsal(rehearsalId);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            const msg = String(e?.message || e || "publish_failed");
            console.error("publish-rehearsal failed:", msg);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: msg }));
          }
          return;
        }

        if (url === "/internal/publish-director-session" && method === "POST") {
          const secret = process.env.INTERNAL_API_SECRET;
          const got = req.headers["x-internal-secret"];
          if (!secret || String(got || "") !== String(secret)) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
            return;
          }

          const body = await readJson(req);
          const projectId = String(body?.projectId || "").trim();
          const sessionId = String(body?.sessionId || "").trim();
          if (!projectId || !sessionId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                ok: false,
                error: "projectId and sessionId are required",
              }),
            );
            return;
          }

          try {
            if (!onPublishDirectorSession) {
              throw new Error("director session publish is not configured");
            }
            await onPublishDirectorSession(projectId, sessionId);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            const msg = String(e?.message || e || "publish_failed");
            console.error("publish-director-session failed:", msg);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: msg }));
          }
          return;
        }

        if (
          url === "/internal/remind-director-session-availability" &&
          method === "POST"
        ) {
          const secret = process.env.INTERNAL_API_SECRET;
          const got = req.headers["x-internal-secret"];
          if (!secret || String(got || "") !== String(secret)) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
            return;
          }

          const body = await readJson(req);
          const projectId = String(body?.projectId || "").trim();
          const sessionId = String(body?.sessionId || "").trim();
          const recipients = Array.isArray(body?.recipients) ? body.recipients : [];
          if (!projectId || !sessionId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                ok: false,
                error: "projectId and sessionId are required",
              }),
            );
            return;
          }

          try {
            if (!onRemindDirectorSessionAvailability) {
              throw new Error("director session reminders are not configured");
            }
            const result = await onRemindDirectorSessionAvailability(
              projectId,
              sessionId,
              recipients,
            );
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                ok: true,
                sentCount: Number(result?.sentCount || 0),
                failedCount: Number(result?.failedCount || 0),
              }),
            );
          } catch (e) {
            const msg = String(e?.message || e || "remind_failed");
            console.error("remind-director-session-availability failed:", msg);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: msg }));
          }
          return;
        }

        res.writeHead(404);
        res.end();
      } catch (e) {
        console.error("HTTP server error:", e?.message || e);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ ok: false, error: String(e?.message || e || "internal_error") }),
        );
      }
    })
    .listen(HEALTH_PORT, "0.0.0.0", () => {
      console.log(`HTTP: http://0.0.0.0:${HEALTH_PORT}/health`);
    });
}

// Импорт обработчиков команд
const ProfileService = require("./src/services/profile/ProfileService");
// const GoogleSheetsService = require("./src/services/googleSheets/googleSheetsService"); // Отключено
const BirthdayService = require("./src/services/birthdayService");
const AttendanceService = require("./src/services/attendanceService");
const AnonymousQuestionService = require("./src/services/anonymousQuestionService");
const { DumpService } = require("./src/services/dumpService");
const { QuizService } = require("./src/services/quizService");

class BotManager {
  constructor(bot) {
    this.bot = bot;
    this.userStates = new Map();
    this.commandHandlers = require("./src/handlers/commandHendlers");
    // this.googleSheets = new GoogleSheetsService(this.bot, this.userStates); // Отключено
    this.profile = new ProfileService(this.bot, this.userStates);
    this.birthdayService = new BirthdayService(bot);
    this.attendance = new AttendanceService(bot, this.userStates);
    this.dumpService = new DumpService(bot);
    this.quizService = new QuizService(bot, this.userStates);
    this.anonymousQuestion = new AnonymousQuestionService(
      this.bot,
      this.userStates,
    );
  }

  /**
   * Инициализация бота
   */
  init() {
    startHttpServer({
      onPublishRehearsal: async (rehearsalId) => {
        await this.attendance.publishRehearsalFromBackend(rehearsalId);
      },
      onPublishDirectorSession: async (projectId, sessionId) => {
        await this.attendance.publishDirectorSessionFromBackend(projectId, sessionId);
      },
      onRemindDirectorSessionAvailability: async (
        projectId,
        sessionId,
        recipients,
      ) => {
        await this.attendance.remindDirectorSessionMissingAvailabilityFromBackend(
          projectId,
          sessionId,
          recipients,
        );
      },
    });
    this._setupStartCommand();
    this._setupMenuHandler();
    this._setupCommands();
    // this._setupRoleManagement();
    this._registerBotCommands();
    this._initServices();
    this._startBot();

    // Runner child mode: accept publish commands via IPC.
    if (String(process.env.RUNNER_CHILD || "").trim() === "1") {
      process.on("message", async (msg) => {
        const requestId = msg?.requestId;
        if (!requestId) return;
        try {
          if (msg.type === "publishRehearsal") {
            const rehearsalId = String(msg.rehearsalId || "").trim();
            if (!rehearsalId) throw new Error("rehearsalId is required");
            const sent = await this.attendance.publishRehearsalFromBackend(rehearsalId);
            process.send?.({ requestId, ok: true, result: sent || null });
            return;
          }
          if (msg.type === "publishDirectorSession") {
            const projectId = String(msg.projectId || "").trim();
            const sessionId = String(msg.sessionId || "").trim();
            if (!projectId || !sessionId)
              throw new Error("projectId and sessionId are required");
            const sent = await this.attendance.publishDirectorSessionFromBackend(
              projectId,
              sessionId,
            );
            process.send?.({ requestId, ok: true, result: sent || null });
            return;
          }
          if (msg.type === "remindDirectorSessionAvailability") {
            const projectId = String(msg.projectId || "").trim();
            const sessionId = String(msg.sessionId || "").trim();
            const recipients = Array.isArray(msg.recipients) ? msg.recipients : [];
            if (!projectId || !sessionId)
              throw new Error("projectId and sessionId are required");
            const out =
              await this.attendance.remindDirectorSessionMissingAvailabilityFromBackend(
                projectId,
                sessionId,
                recipients,
              );
            process.send?.({ requestId, ok: true, result: out || null });
            return;
          }
          process.send?.({ requestId, ok: false, error: "unknown_command" });
        } catch (e) {
          process.send?.({
            requestId,
            ok: false,
            error: String(e?.message || e || "failed"),
          });
        }
      });
    }
  }

  _isOwner(ctx) {
    const ownerId = process.env.OWNER_TELEGRAM_ID;
    return (
      ctx?.from?.id != null &&
      ownerId &&
      String(ctx.from.id) === String(ownerId)
    );
  }

  /** Клавиатура главного меню: все команды кроме квиза; вместо них одна кнопка «Викторина» */
  _getMenuKeyboard(isOwner) {
    const visible = COMMANDS.filter(
      (c) => c.command !== "start" && !c.isQuiz && (!c.adminOnly || isOwner),
    );
    const labels = visible.map((c) => c.shortDescription);
    labels.push(QUIZ_SUBMENU_LABEL);
    const rows = [];
    for (let i = 0; i < labels.length; i += 2) {
      rows.push(labels.slice(i, i + 2));
    }
    return Markup.keyboard(rows).resize();
  }

  /** Клавиатура подменю викторины: команды квиза + «Назад в меню» */
  _getQuizSubmenuKeyboard(isOwner) {
    const quizCommands = COMMANDS.filter(
      (c) => c.isQuiz && (!c.adminOnly || isOwner),
    );
    const labels = quizCommands.map((c) => c.shortDescription);
    labels.push(BACK_TO_MENU_LABEL);
    const rows = [];
    for (let i = 0; i < labels.length; i += 2) {
      rows.push(labels.slice(i, i + 2));
    }
    return Markup.keyboard(rows).resize();
  }

  /** Обработка нажатия кнопки меню (только личка): Викторина → подменю, Назад в меню → главное меню, иначе команда по подписи */
  _setupMenuHandler() {
    this.bot.use(async (ctx, next) => {
      const text = ctx.message?.text;
      if (ctx.chat?.type !== "private" || !text) return next();
      if (text === QUIZ_SUBMENU_LABEL) {
        await ctx.reply(
          "Викторина — выберите действие:",
          this._getQuizSubmenuKeyboard(this._isOwner(ctx)),
        );
        return;
      }
      if (text === BACK_TO_MENU_LABEL) {
        await ctx.reply(
          "Выберите команду:",
          this._getMenuKeyboard(this._isOwner(ctx)),
        );
        return;
      }
      const cmd = COMMANDS.find((c) => c.shortDescription === text);
      if (!cmd) return next();
      try {
        await this._runCommand(ctx, cmd.command);
      } catch (e) {
        console.error("Menu command error:", cmd.command, e?.message || e);
        return next();
      }
    });
  }

  /** Выполнить команду по имени (то же, что при вводе /command) */
  async _runCommand(ctx, commandName) {
    const handlers = {
      profile: () => this.profile.initMainProfileHendler(ctx, this.userStates),
      me: () => this.profile.initMainProfileHendler(ctx, this.userStates),
      register: () => this.profile.registerUser(ctx, this.userStates),
      // addguest: () => this.googleSheets.initGuestCommands(ctx, this.userStates), // Отключено
      // guests: () => this.googleSheets.startGetList(ctx), // Отключено
      // newpage: () => this.googleSheets.initNewPageCommands(ctx), // Отключено
      checkbirthdays: () => this.birthdayService.showBirthdaysTable(ctx),
      question: () => this.anonymousQuestion.initQuestion(ctx),
      // setrehearsal: () => this.attendance.startSetRehearsal(ctx), // Старый формат (локальное хранилище)
      setgroup: () => this.attendance.startSetGroup(ctx),
      who: () => this.attendance.showWhoIsComing(ctx),
      rehearsable: () => this.attendance.showRehearsableScenes(ctx),
      remindattendance: () =>
        this.attendance.manualSendAttendanceReminders(ctx),
      userslist: () => this._handleUsersList(ctx),
      help: () => {
        const { getHelpMessage } = require("./src/handlers/commandHendlers");
        return ctx.reply(getHelpMessage(ctx), { parse_mode: "HTML" });
      },
      leaderboard: () => this.quizService.showLeaderboard(ctx),
      addquiz: () => this.quizService.startAddQuiz(ctx),
      callquiz: () => this.quizService.startCallQuiz(ctx),
      quizlist: () => this.quizService.showQuizList(ctx),
      deletequiz: () => this.quizService.startDeleteQuiz(ctx),
      dump: () => this.dumpService.sendDumpToOwner(ctx),
      menu: () =>
        ctx.reply(
          "Выберите команду:",
          this._getMenuKeyboard(this._isOwner(ctx)),
        ),
    };
    const fn = handlers[commandName];
    if (fn) await fn();
  }

  async _handleUsersList(ctx) {
    if (!this._isOwner(ctx)) {
      return ctx.reply("Эта команда доступна только организатору.");
    }
    const { getUsersData } = require("./src/api/userApi");
    const { formatUsersTable } = require("./src/utils/formatters");
    try {
      await ctx.reply("Загружаю список пользователей…");
      const users = await getUsersData();
      const table = formatUsersTable(users);
      const MAX_LEN = 4000;
      if (table.length > MAX_LEN) {
        await ctx.telegram.sendDocument(ctx.from.id, {
          source: Buffer.from(table, "utf8"),
          filename: `users-${new Date().toISOString().slice(0, 10)}.txt`,
        });
        await ctx.reply("Список отправлен файлом (данных много).");
      } else {
        await ctx.reply(
          "<pre>" +
            table.replace(/</g, "&lt;").replace(/>/g, "&gt;") +
            "</pre>",
          { parse_mode: "HTML" },
        );
      }
    } catch (e) {
      console.error("userslist:", e);
      await ctx.reply(
        "Не удалось загрузить список. Проверьте доступ к серверу.",
      );
    }
  }

  /**
   * Настройка базовых команд
   */
  _setupStartCommand() {
    this.bot.start((ctx) => {
      ctx.reply(
        `Привет, ${ctx.from.first_name}! Я помогу тебе с напоминаниями и репетициями 🎭`,
      );
      if (ctx.chat?.type === "private") {
        ctx.reply(
          "Выберите команду:",
          this._getMenuKeyboard(this._isOwner(ctx)),
        );
      }
    });
  }

  _setupCommands() {
    this.bot.command(["profile", "me"], (ctx) => {
      this.profile.initMainProfileHendler(ctx, this.userStates);
    });
    this.bot.command("register", (ctx) =>
      this.profile.registerUser(ctx, this.userStates),
    );
    // this.bot.command("addguest", (ctx) =>
    //   this.googleSheets.initGuestCommands(ctx, this.userStates),
    // ); // Отключено
    // this.bot.command("guests", async (ctx) => {
    //   this.googleSheets.startGetList(ctx);
    // }); // Отключено
    // this.bot.command("newpage", (ctx) => {
    //   this.googleSheets.initNewPageCommands(ctx);
    // }); // Отключено
    this.bot.command("checkbirthdays", async (ctx) => {
      await this.birthdayService.showBirthdaysTable(ctx);
    });
    this.bot.command("testattendance", (ctx) => {
      this.attendance.manualSendAttendanceMessage(ctx);
    });
    this.bot.command("setrehearsal", (ctx) => {
      this.attendance.startSetRehearsal(ctx);
    });
    this.bot.command("setgroup", (ctx) => {
      this.attendance.startSetGroup(ctx);
    });
    this.bot.command("who", (ctx) => {
      this.attendance.showWhoIsComing(ctx);
    });
    this.bot.command("remindattendance", (ctx) => {
      this.attendance.manualSendAttendanceReminders(ctx);
    });
    this.bot.command("rehearsable", (ctx) => {
      this.attendance.showRehearsableScenes(ctx);
    });
    this.bot.command("question", async (ctx) => {
      await this.anonymousQuestion.initQuestion(ctx);
    });
    this.bot.command("userslist", (ctx) => this._runCommand(ctx, "userslist"));
    this.bot.command("menu", (ctx) => {
      if (ctx.chat?.type === "private") {
        ctx.reply(
          "Выберите команду:",
          this._getMenuKeyboard(this._isOwner(ctx)),
        );
      } else {
        ctx.reply("Меню доступно только в личных сообщениях с ботом.");
      }
    });
    this.bot.command("help", (ctx) => {
      const { getHelpMessage } = require("./src/handlers/commandHendlers");
      ctx.reply(getHelpMessage(ctx), { parse_mode: "HTML" });
    });
  }

  /**
   * Регистрация команд в меню бота
   */
  _registerBotCommands() {
    this.commandHandlers.init(this.bot);
  }

  /**
   * Инициализация служб бота
   */
  _initServices() {
    this.anonymousQuestion.init();
    this.profile.init();
    // this.googleSheets.init(); // Отключено
    this.birthdayService.init();
    this.attendance.init();
    this.dumpService.init();
    this.quizService.init();
  }

  _initMassegeHendlers() {
    // this.googleSheets.initMessageHendlers(); // Отключено
    this.profile.initMessageHendlers();
  }

  /**
   * Запуск бота
   */
  _startBot() {
    this.bot
      .launch()
      .then(() => {
        console.log("Бот запущен ✅");
      })
      .catch((err) => {
        console.error("Ошибка запуска бота:", err);
      });

    // Включаем graceful stop
    if (String(process.env.RUNNER_CHILD || "").trim() !== "1") {
      process.once("SIGINT", () => this.bot.stop("SIGINT"));
      process.once("SIGTERM", () => this.bot.stop("SIGTERM"));
    }
  }
}

// Создаем и инициализируем менеджер бота
const botManager = new BotManager(bot);
botManager.init();
