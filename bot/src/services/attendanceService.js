const cron = require("node-cron");
const { Markup } = require("telegraf");
const rehearsalStorage = require("./rehearsalStorage");
const settingsStorage = require("./settingsStorage");
const { normalizeSupergroupId } = require("../utils/telegramUtils");
const { getUserData, getUsersData } = require("../api/userApi");
const orchestraBotApi = require("../api/orchestraBotApi");
const escapeHtml = require("../utils/escapeHtml");
const PLAYS = require("../const/PLAYS");
const PLAY_SCENES = require("../const/PLAY_SCENES");

function formatRuDateTime(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso || "");
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
  } catch {
    return String(iso || "");
  }
}

function statusIcon(status) {
  if (status === "present") return "✅";
  if (status === "absent") return "❌";
  if (status === "late") return "⏰";
  return "❔";
}

class AttendanceService {
  constructor(bot, userStates) {
    this.bot = bot;
    this.userStates = userStates || new Map();
    this.ownerId = process.env.OWNER_TELEGRAM_ID;
  }

  _extractTimeLike(text) {
    const t = String(text || "").trim();
    if (!t) return null;
    // Try to extract HH:MM from arbitrary text like "приду к 20:00"
    const m = t.match(/\b([01]?\d|2[0-3])[:.](\d{2})\b/);
    if (!m) return null;
    const hh = String(m[1]).padStart(2, "0");
    const mm = String(m[2]).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  async _updateBackendRehearsalMessage(rehearsalId) {
    const rehearsal = await orchestraBotApi.getRehearsal(rehearsalId);
    const title = escapeHtml(rehearsal?.title || "Репетиция");
    const startsAt = rehearsal?.startsAt ? formatRuDateTime(rehearsal.startsAt) : "";
    const place = rehearsal?.place ? `\n${escapeHtml(rehearsal.place)}` : "";
    const listText = this._formatBackendAttendanceList(rehearsal);
    const text = `<b>${title}</b>\n${escapeHtml(startsAt)}${place}\n\nПодтверждение присутствия\n\n${listText}`;

    const chatId = rehearsal?.telegramChatId != null ? String(rehearsal.telegramChatId).trim() : "";
    const messageIdRaw =
      rehearsal?.telegramMessageId != null ? String(rehearsal.telegramMessageId).trim() : "";
    const messageId = messageIdRaw && /^\d+$/.test(messageIdRaw) ? parseInt(messageIdRaw, 10) : null;

    if (!chatId || !messageId) return;

    try {
      await this.bot.telegram.editMessageText(chatId, messageId, undefined, text, {
        parse_mode: "HTML",
        ...this._backendKeyboard(rehearsalId),
      });
    } catch (e) {
      const desc = e?.response?.description || "";
      if (e?.response?.error_code === 400 && /message is not modified/i.test(desc)) {
        return;
      }
      console.error("Ошибка обновления сообщения репетиции (backend):", e?.message || e);
    }
  }

  /**
   * ID супергруппы (chat_id). В .env: GROUP_CHAT_ID (с минусом, напр. -1001494331205).
   * Нормализует короткий вид -1494331205 в полный -1001494331205 (Telegram требует -100...).
   */
  getEffectiveGroupChatId() {
    const raw = settingsStorage.getGroupChatId() || process.env.GROUP_CHAT_ID;
    return normalizeSupergroupId(raw);
  }

  /**
   * ID топика в группе (message_thread_id). В .env: GROUP_CHAT_ID_ATTENTION или ATTENDANCE_THREAD_ID (напр. 41051).
   */
  getEffectiveThreadId() {
    return (
      settingsStorage.getAttendanceThreadId() ||
      process.env.GROUP_CHAT_ID_ATTENTION ||
      process.env.ATTENDANCE_THREAD_ID ||
      "41051"
    );
  }

  isOwner(userId) {
    return this.ownerId && String(userId) === String(this.ownerId);
  }

  /**
   * Задать группу для опросов: из группы — сохранить текущий чат; из лички — запросить ID.
   */
  async startSetGroup(ctx) {
    const userId = ctx.from.id;
    if (!this.isOwner(userId)) {
      return ctx.reply("Эта команда доступна только организатору.");
    }

    const chatType = ctx.chat?.type;
    if (chatType === "group" || chatType === "supergroup") {
      const chatId = String(ctx.chat.id);
      const threadId = ctx.message?.message_thread_id;
      settingsStorage.setGroupChatId(chatId);
      if (threadId != null) {
        settingsStorage.setAttendanceThreadId(String(threadId));
        settingsStorage.setAnnouncementsThreadId(String(threadId));
        await ctx.reply(
          `Группа и топик сохранены.\nГруппа: ${chatId}\nТопик: ${threadId}\nОпросы и уведомления будут отправляться в этот топик. Чтобы сменить — отправьте /setgroup в другом топике или в личке введите ID в формате -1494331205/41051.`,
        );
      } else {
        await ctx.reply(
          `Группа сохранена. ID: ${chatId}. Сообщения пойдут в общий чат группы. Чтобы указать топик — отправьте /setgroup прямо из нужного топика или в личке введите ID группы и топика в формате -1494331205/41051.`,
        );
      }
      return;
    }

    this.userStates.set(userId, { step: "setgroup_wait_id", data: {} });
    await ctx.reply(
      "Введите ID супергруппы и топика в формате:\n<code>-1494331205/41051</code>\n\n(супергруппа всегда с минусом; число после слэша — ID топика). Можно только ID группы: <code>-1494331205</code> — тогда сообщения пойдут в общий чат.\n\nОтмена: /cancel",
      { parse_mode: "HTML" },
    );
  }

  /**
   * Обработка ввода ID группы (шаг setgroup_wait_id)
   */
  async handleSetGroupMessage(ctx) {
    const userId = ctx.from.id;
    const state = this.userStates.get(userId);
    if (!state || state.step !== "setgroup_wait_id") return false;

    const text = (ctx.message?.text || "").trim();
    if (/^\/cancel$/i.test(text)) {
      this.userStates.delete(userId);
      await ctx.reply("Настройка группы отменена.");
      return true;
    }

    const input = text.replace(/\s/g, "");
    const slashIdx = input.indexOf("/");
    let groupId;
    let threadIdStr = null;

    if (slashIdx >= 0) {
      groupId = input.slice(0, slashIdx).trim();
      threadIdStr = input
        .slice(slashIdx + 1)
        .trim()
        .replace(/\/$/, "");
    } else {
      groupId = input;
    }

    if (!/^-?\d+$/.test(groupId)) {
      await ctx.reply(
        "Неверный формат группы. Укажите ID супергруппы (с минусом), например -1494331205, или группу и топик: -1494331205/41051.",
      );
      return true;
    }

    if (
      threadIdStr != null &&
      threadIdStr !== "" &&
      !/^\d+$/.test(threadIdStr)
    ) {
      await ctx.reply(
        "Неверный формат топика. ID топика — число без минуса, например 41051.",
      );
      return true;
    }

    this.userStates.delete(userId);
    settingsStorage.setGroupChatId(groupId);
    if (threadIdStr != null && threadIdStr !== "") {
      settingsStorage.setAttendanceThreadId(threadIdStr);
      settingsStorage.setAnnouncementsThreadId(threadIdStr);
      await ctx.reply(
        `Группа и топик сохранены. Группа: ${groupId}, топик: ${threadIdStr}.`,
      );
    } else {
      settingsStorage.setAttendanceThreadId(null);
      settingsStorage.setAnnouncementsThreadId(null);
      await ctx.reply(`Группа сохранена. ID: ${groupId} (без топика).`);
    }
    return true;
  }

  /**
   * Начать создание репетиции (только для владельца)
   */
  startSetRehearsal(ctx) {
    const userId = ctx.from.id;
    if (!this.isOwner(userId)) {
      return ctx.reply("Эта команда доступна только организатору.");
    }
    this.userStates.set(userId, {
      step: "setrehearsal_date",
      data: {},
    });
    ctx.reply(
      "Введите дату репетиции: ДД.ММ или ДД.ММ.ГГГГ, или «завтра», или день недели (понедельник, вторник, пятница и т.д.):",
    );
  }

  /**
   * Обработка шагов создания репетиции
   */
  async handleSetRehearsalMessage(ctx) {
    const userId = ctx.from.id;
    const state = this.userStates.get(userId);
    if (!state || !state.step?.startsWith("setrehearsal_")) return false;

    const text = (ctx.message?.text || "").trim();

    if (state.step === "setrehearsal_date") {
      const parsed = rehearsalStorage.parseDate(text);
      if (!parsed) {
        await ctx.reply(
          "Неверный формат. Введите ДД.ММ, ДД.ММ.ГГГГ, «завтра» или день недели (вторник, пятница и т.д.):",
        );
        return true;
      }
      state.data.dateKey = parsed.dateKey;
      state.data.dateDisplay = parsed.display;
      state.step = "setrehearsal_time";
      this.userStates.set(userId, state);
      await ctx.reply("Введите время (например 18:00):");
      return true;
    }

    if (state.step === "setrehearsal_time") {
      state.data.time = text;
      this.userStates.delete(userId);

      const rehearsal = {
        dateKey: state.data.dateKey,
        dateDisplay: state.data.dateDisplay,
        time: state.data.time,
        place: "",
      };

      rehearsalStorage.setNextRehearsal(rehearsal);

      await ctx.reply(
        `Репетиция создана: ${state.data.dateDisplay} в ${state.data.time}.`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "Отправить опрос в группу",
              `rehearsal_send_to_group_${rehearsal.dateKey}`,
            ),
          ],
        ]),
      );
      return true;
    }

    return false;
  }

  /**
   * Отправить опрос о явке в группу
   */
  async sendAttendanceMessage(dateKeyParam) {
    const groupChatId = this.getEffectiveGroupChatId();
    const threadId = this.getEffectiveThreadId();

    if (!groupChatId) {
      console.warn(
        "Группа не задана: используйте /setgroup или задайте GROUP_CHAT_ID в .env (ID супергруппы с минусом)",
      );
      return;
    }

    let rehearsal = null;

    if (dateKeyParam) {
      rehearsal =
        rehearsalStorage.getRehearsal(dateKeyParam) ||
        rehearsalStorage.getNextRehearsal();
    } else {
      rehearsal = rehearsalStorage.getNextRehearsal();
    }

    if (!rehearsal) {
      try {
        await this.bot.telegram.sendMessage(
          groupChatId,
          "Репетиция не запланирована. Используйте /setrehearsal в личке с ботом.",
          { message_thread_id: parseInt(threadId, 10) },
        );
      } catch (e) {
        console.error("Ошибка отправки в группу:", e);
      }
      return;
    }

    const dateKey = rehearsal.dateKey;
    const listText = await this.formatAttendanceList(dateKey);
    const placePart = rehearsal.place ? `, ${escapeHtml(rehearsal.place)}` : "";
    const text = `<b>${escapeHtml(
      rehearsal.dateDisplay,
    )} в ${escapeHtml(rehearsal.time)}${placePart}</b>\n\nПодтверждение присутствия\n\n${listText}`;
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback("Буду", `rehearsal_${dateKey}_coming`),
        Markup.button.callback("😢", `rehearsal_${dateKey}_not_coming`),
      ],
      [
        Markup.button.callback(
          "Буду позже",
          `rehearsal_${dateKey}_late`,
        ),
      ],
    ]);

    try {
      const sent = await this.bot.telegram.sendMessage(groupChatId, text, {
        message_thread_id: parseInt(threadId, 10),
        parse_mode: "HTML",
        ...keyboard,
      });
      rehearsalStorage.setAttendanceMessageInfo(
        groupChatId,
        sent.message_id,
        dateKey,
      );
    } catch (error) {
      console.error("Ошибка при отправке опроса явки:", error);
      throw error;
    }
  }

  /** Построить таблицу явок: «Присутствие» / «Отсутствие» + собрать список опаздывающих */
  async _buildAttendanceTable(dateKey) {
    const attendance = rehearsalStorage.getAttendance(dateKey);
    const coming = [];
    const notComing = [];
    const late = [];
    const attendingCharacters = new Set();

    const entries = Object.entries(attendance);

    for (const [uid, { status, userName, meta = {} }] of entries) {
      let displayName = userName || "Участник";
      let rolesText = "";
      let roles = [];
      try {
        const user = await getUserData(String(uid));
        if (user?.name || user?.surname) {
          const full = [user.name, user.surname].filter(Boolean).join(" ").trim();
          if (full) displayName = full;
        }
        const chars = user?.characters || [];
        roles = chars
          .map((c) => String(c).trim())
          .filter(Boolean);
        if (roles.length) {
          rolesText = roles.join(", ");
        }
      } catch (e) {
        if (e.response?.status !== 404) {
          console.warn(
            "Attendance: не удалось получить данные пользователя для таблицы:",
            e.message || e,
          );
        }
      }

      const nameHtml = `<b>${escapeHtml(displayName)}</b>`;
      const rolesHtml = rolesText
        ? `<i>(${escapeHtml(rolesText)})</i>`
        : "";
      const fullLabel = rolesHtml
        ? `${nameHtml}\n  ${rolesHtml}`
        : nameHtml;

      if (status === "coming" || status === "late") {
        // Опаздывающие считаются присутствующими и остаются в колонке «Присутствие»
        coming.push(fullLabel);
        roles.forEach((r) => attendingCharacters.add(r));
      }

      if (status === "not_coming") {
        notComing.push(fullLabel);
      } else if (status === "late") {
        const lateText =
          typeof meta?.lateText === "string" && meta.lateText.trim()
            ? meta.lateText.trim()
            : "";
        const baseName = `<b>${escapeHtml(displayName)}</b>`;
        const label =
          lateText.length > 0
            ? `${baseName} — ${lateText}`
            : `${baseName} — придёт позже`;
        late.push(label);
      }
    }

    const h1 = "Присутствие";
    const h2 = "Отсутствие";

    const lines = [];

    // Блок «Присутствие»
    lines.push(h1 + ":");
    if (coming.length === 0) {
      lines.push("—");
    } else {
      for (const name of coming) {
        lines.push(`• ${name}`);
      }
    }

    lines.push(""); // пустая строка между блоками

    // Блок «Отсутствие»
    lines.push(h2 + ":");
    if (notComing.length === 0) {
      lines.push("—");
    } else {
      for (const name of notComing) {
        lines.push(`• ${name}`);
      }
    }

    return {
      table: lines.join("\n"),
      late,
      attendingCharacters,
    };
  }

  /** Текст списка явок для вставки в сообщение опроса (таблица Присутствие/Отсутствие) */
  async formatAttendanceList(dateKey) {
    const { table, late, attendingCharacters } =
      await this._buildAttendanceTable(dateKey);

    const lines = [table];

    if (late.length) {
      lines.push("", "Буду позже:");
      lines.push(...late);
    }

    const presentRoles = attendingCharacters || new Set();

    // Добавляем блок по каждому спектаклю: какие роли есть и каких не хватает
    for (const [playTitle, playRolesArr] of Object.entries(PLAYS)) {
      const playRoles = Array.isArray(playRolesArr) ? playRolesArr : [];
      if (!playRoles.length) continue;

      const present = [];
      const missing = [];
      for (const role of playRoles) {
        if (presentRoles.has(role)) present.push(role);
        else missing.push(role);
      }

      lines.push("", `🎭 ${escapeHtml(playTitle)}`);
      if (missing.length === 0 && present.length > 0) {
        // Все роли спектакля покрыты присутствующими
        lines.push("Все персонажи набраны");
      } else {
        lines.push(
          `Роли будут: ${
            present.length ? escapeHtml(present.join(", ")) : "—"
          }`,
        );
        lines.push(
          `Роли отсутствуют: ${
            missing.length ? escapeHtml(missing.join(", ")) : "—"
          }`,
        );
      }
    }

    return lines.join("\n");
  }

  /**
   * Ручная отправка опроса (для тестирования или по запросу)
   */
  async manualSendAttendanceMessage(ctx) {
    try {
      await this.sendAttendanceMessage();
      await ctx.reply(
        "Опрос отправлен в группу (или сообщение о том, что репетиция не задана).",
      );
    } catch (error) {
      console.error("Ошибка при ручной отправке опроса:", error);
      await ctx.reply("Не удалось отправить опрос.");
    }
  }

  /**
   * Ручной запуск напоминаний о явке (для тестирования; только организатор).
   */
  async manualSendAttendanceReminders(ctx) {
    const userId = ctx.from?.id;
    if (!this.isOwner(userId)) {
      return ctx.reply("Эта команда доступна только организатору.");
    }
    await ctx.reply("Отправляю напоминания о явке…");
    try {
      await this.sendAttendanceReminders();
      await ctx.reply("Готово: напоминания отправлены всем, кто ещё не отметился.");
    } catch (e) {
      console.error("manualSendAttendanceReminders error:", e);
      await ctx.reply("Не удалось отправить напоминания.");
    }
  }

  /**
   * Имя для переклички: из БД по Telegram ID (имя + фамилия), иначе из Telegram.
   */
  async _getDisplayNameForAttendance(telegramUserId) {
    try {
      const user = await getUserData(String(telegramUserId));
      if (user?.name != null) {
        const full = [user.name, user.surname].filter(Boolean).join(" ").trim();
        return full || user.name || "Участник";
      }
    } catch (e) {
      if (e.response?.status !== 404) {
        console.warn(
          "Attendance: не удалось получить имя из БД:",
          e.message || e,
        );
      }
    }
    return null;
  }

  /**
   * Обработка ответа «Опаздываю»: бот спрашивает в личке «на сколько», сохраняет ответ и обновляет таблицу.
   */
  async handleLateMessage(ctx) {
    if (ctx.chat?.type !== "private") return false;
    const userId = ctx.from?.id;
    const state = this.userStates.get(userId);
    if (!state || state.step !== "attendance_late") return false;

    const text = (ctx.message?.text || "").trim();
    if (!text) {
      await ctx.reply(
        "Напишите, к которому времени вы придёте (например: 19:30).",
      );
      return true;
    }

    const { dateKey } = state.data || {};
    this.userStates.delete(userId);
    if (!dateKey) return true;

    const userName =
      (await this._getDisplayNameForAttendance(userId)) ||
      ctx.from.first_name ||
      ctx.from.username ||
      "Участник";

    rehearsalStorage.setAttendance(dateKey, userId, userName, "late", {
      lateText: text,
    });

    await ctx.reply(`Отметил: вы будете к ${text}.`);

    const info = rehearsalStorage.getAttendanceMessageInfo(dateKey);
    if (info) {
      const rehearsal =
        rehearsalStorage.getRehearsal(dateKey) ||
        rehearsalStorage.getNextRehearsal();
      if (rehearsal) {
        const listText = await this.formatAttendanceList(dateKey);
        const placePart = rehearsal.place
          ? `, ${escapeHtml(rehearsal.place)}`
          : "";
        const textMsg = `<b>${escapeHtml(
          rehearsal.dateDisplay,
        )} в ${escapeHtml(rehearsal.time)}${placePart}</b>\n\nПодтверждение присутствия\n\n${listText}`;
        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback("Буду", `rehearsal_${dateKey}_coming`),
            Markup.button.callback("😢", `rehearsal_${dateKey}_not_coming`),
          ],
          [
            Markup.button.callback(
              "Буду позже",
              `rehearsal_${dateKey}_late`,
            ),
          ],
        ]);
        try {
          await this.bot.telegram.editMessageText(
            info.chatId,
            info.messageId,
            undefined,
            textMsg,
            { ...keyboard, parse_mode: "HTML" },
          );
        } catch (e) {
          const desc = e?.response?.description || "";
          if (
            e?.response?.error_code === 400 &&
            /message is not modified/i.test(desc)
          ) {
            // Телеграм ругается, если текст и клавиатура не изменились — это нормальная ситуация, просто игнорируем.
          } else {
            console.error("Ошибка обновления сообщения опроса (late):", e);
          }
        }
      }
    }

    return true;
  }

  /**
   * Обработка ввода времени для "Свое время" (backend rehearsal): сохраняем lateTime и обновляем сообщение в группе.
   */
  async handleBackendLateMessage(ctx) {
    if (ctx.chat?.type !== "private") return false;
    const userId = ctx.from?.id;
    const state = this.userStates.get(userId);
    if (!state || state.step !== "backend_attendance_late") return false;

    const text = (ctx.message?.text || "").trim();
    if (/^\/cancel$/i.test(text)) {
      this.userStates.delete(userId);
      await ctx.reply("Ок, отменил ввод времени.");
      return true;
    }
    if (!text) {
      await ctx.reply("Напишите, к которому времени вы придёте (например: 20:00).");
      return true;
    }

    const { rehearsalId } = state.data || {};
    this.userStates.delete(userId);
    if (!rehearsalId) return true;

    const userName =
      (ctx.from?.username && String(ctx.from.username).trim()) ||
      [ctx.from?.first_name, ctx.from?.last_name]
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .join(" ")
        .trim() ||
      undefined;

    const extracted = this._extractTimeLike(text);
    const lateTime = extracted || text;

    try {
      await orchestraBotApi.setRehearsalAttendance(rehearsalId, {
        telegramId: String(userId),
        status: "late",
        userName,
        lateTime,
      });
      await ctx.reply(`Отметил: вы будете к ${lateTime}.`);
    } catch (e) {
      console.error("Ошибка сохранения lateTime (backend):", e?.message || e);
      await ctx.reply("Не удалось сохранить время. Попробуйте ещё раз позже.");
      return true;
    }

    // Обновляем опубликованное сообщение в группе (если оно уже опубликовано)
    try {
      await this._updateBackendRehearsalMessage(rehearsalId);
    } catch (e) {
      // Не критично: время уже сохранено
      console.warn(
        "Не удалось обновить сообщение репетиции в группе (backend):",
        e?.message || e,
      );
    }

    return true;
  }

  /**
   * Обработка нажатия кнопки явки (кнопки «Буду» / «Не буду» / «Опаздываю»; в тексте — «Присутствие» / «Отсутствие» / «Опаздываю»)
   */
  async handleAttendanceCallback(ctx) {
    const match = ctx.match || [];
    const dateKey = match[1];
    const status = match[2];
    if (!dateKey || !status) return;

    const statusLabels = {
      coming: "Присутствие",
      not_coming: "Отсутствие",
      late: "Опаздываю",
    };
    const label = statusLabels[status] || status;

    const userId = ctx.from.id;

    if (status === "late") {
      await ctx.answerCbQuery(`Отмечено: ${label}`);
      try {
        await this.bot.telegram.sendMessage(
          userId,
          "Вы отметились как «Опаздываю». Напишите, к которому времени вы придёте (например: 19:30).",
        );
        this.userStates.set(userId, {
          step: "attendance_late",
          data: { dateKey },
        });
      } catch (e) {
        const desc = e?.response?.description || "";
        const code = e?.response?.error_code;
        if (
          code === 403 &&
          /can't initiate conversation with a user/i.test(desc)
        ) {
          // Бот не может сам начать ЛС — покажем подсказку во всплывающем окне
          try {
            await ctx.answerCbQuery(
              "Я не могу написать вам в личку. Откройте чат со мной, нажмите /start и потом ещё раз нажмите «Буду позже».",
              { show_alert: true },
            );
          } catch (err) {
            console.warn(
              "Ошибка показа alert для невозможности ЛС (late):",
              err?.response?.description || err?.message || err,
            );
          }
        } else {
          console.error("Ошибка отправки ЛС для опоздания:", e);
        }
      }
      return;
    }

    const userName =
      (await this._getDisplayNameForAttendance(userId)) ||
      ctx.from.first_name ||
      ctx.from.username ||
      "Участник";

    rehearsalStorage.setAttendance(dateKey, userId, userName, status);
    await ctx.answerCbQuery(`Отмечено: ${label}`);

    // Обновляем сообщение опроса в группе: под текстом показываем таблицу явок
    const info = rehearsalStorage.getAttendanceMessageInfo(dateKey);
    if (info) {
      const rehearsal =
        rehearsalStorage.getRehearsal(dateKey) ||
        rehearsalStorage.getNextRehearsal();
      if (rehearsal) {
        const listText = await this.formatAttendanceList(dateKey);
        const placePart = rehearsal.place
          ? `, ${escapeHtml(rehearsal.place)}`
          : "";
        const text = `<b>${escapeHtml(
          rehearsal.dateDisplay,
        )} в ${escapeHtml(rehearsal.time)}${placePart}</b>\n\nПодтверждение присутствия\n\n${listText}`;
        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback("Буду", `rehearsal_${dateKey}_coming`),
            Markup.button.callback("😢", `rehearsal_${dateKey}_not_coming`),
          ],
          [
            Markup.button.callback(
              "Буду позже",
              `rehearsal_${dateKey}_late`,
            ),
          ],
        ]);
        try {
          await this.bot.telegram.editMessageText(
            info.chatId,
            info.messageId,
            undefined,
            text,
            { ...keyboard, parse_mode: "HTML" },
          );
        } catch (e) {
          const desc = e?.response?.description || "";
          if (
            e?.response?.error_code === 400 &&
            /message is not modified/i.test(desc)
          ) {
            // Текст и разметка такие же, как были — телеграм присылает 400, но для нас это не ошибка.
          } else {
            console.error("Ошибка обновления сообщения опроса:", e);
          }
        }
      }
    }
  }

  /**
   * Показать, какие сцены можно порепетировать при заявленной явке (по сценам и ролям из PLAY_SCENES).
   * Только организатор, только в личке с ботом.
   */
  async showRehearsableScenes(ctx) {
    if (ctx.chat?.type !== "private") {
      return ctx.reply(
        "Эта команда доступна только в личных сообщениях с ботом.",
      );
    }
    if (!this.isOwner(ctx.from?.id)) {
      return ctx.reply("Эта команда доступна только организатору.");
    }

    const next = rehearsalStorage.getNextRehearsal();
    if (!next) {
      return ctx.reply(
        "Ближайшая репетиция не задана. Используйте /setrehearsal и отправьте опрос «Кто будет?».",
      );
    }

    const attendance = rehearsalStorage.getAttendance(next.dateKey);
    const comingUserIds = Object.entries(attendance)
      .filter(([, data]) => data.status === "coming")
      .map(([uid]) => uid);

    if (comingUserIds.length === 0) {
      return ctx.reply(
        "Пока никто не отметился «Буду». Отметьтесь в опросе репетиции — тогда можно будет посмотреть, какие сцены доступны.",
      );
    }

    const attendingCharacters = new Set();
    for (const uid of comingUserIds) {
      try {
        const user = await getUserData(uid);
        const chars = user?.characters || [];
        chars.forEach((c) => attendingCharacters.add(String(c).trim()));
      } catch (e) {
        // пользователь не в БД или ошибка — пропускаем
      }
    }

    const placePart = next.place ? `, ${next.place}` : "";
    const lines = [
      `Репетиция ${next.dateDisplay} в ${next.time}${placePart}.`,
      `Будут: ${comingUserIds.length} чел.`,
      "",
      "Что можно порепетировать (по заявленной явке и ролям):",
      "",
    ];

    let hasAny = false;
    for (const [playTitle, scenes] of Object.entries(PLAY_SCENES)) {
      const playRoles = new Set(PLAYS[playTitle] || []);
      const coveredInPlay = new Set(
        [...attendingCharacters].filter((r) => playRoles.has(r)),
      );

      const rehearsable = (scenes || []).filter((scene) =>
        (scene.roles || []).every((r) => coveredInPlay.has(r)),
      );
      const notRehearsable = (scenes || []).filter(
        (scene) => !(scene.roles || []).every((r) => coveredInPlay.has(r)),
      );

      if (rehearsable.length > 0) {
        hasAny = true;
        lines.push(`🎭 ${playTitle}`);
        rehearsable.forEach((s) => lines.push(`  ✅ ${s.name}`));
        if (notRehearsable.length > 0) {
          notRehearsable.forEach((s) => {
            const missing = (s.roles || []).filter(
              (r) => !coveredInPlay.has(r),
            );
            lines.push(`  ❌ ${s.name} (нет: ${missing.join(", ")})`);
          });
        }
        lines.push("");
      } else if (scenes?.length > 0) {
        lines.push(`🎭 ${playTitle}`);
        scenes.forEach((s) => {
          const missing = (s.roles || []).filter((r) => !coveredInPlay.has(r));
          lines.push(`  ❌ ${s.name} (нет: ${missing.join(", ")})`);
        });
        lines.push("");
      }
    }

    if (!hasAny && lines.length > 4) {
      lines.push("Пока ни одной сцены не хватает ролей по явке.");
    } else if (Object.keys(PLAY_SCENES).length === 0) {
      lines.push("Сцены не заданы. Добавьте их в bot/src/const/PLAY_SCENES.js");
    }

    await ctx.reply(lines.join("\n"));
  }

  /**
   * Показать, кто идёт на ближайшую репетицию
   */
  async showWhoIsComing(ctx) {
    const next = rehearsalStorage.getNextRehearsal();
    if (!next) {
      return ctx.reply(
        "Ближайшая репетиция не задана. Используйте /setrehearsal.",
      );
    }

    const placePart = next.place ? `, ${next.place}` : "";
    const table = await this.formatAttendanceList(next.dateKey);
    const header = `<b>${escapeHtml(
      next.dateDisplay,
    )} в ${escapeHtml(next.time)}${escapeHtml(placePart)}</b>`;
    const text = `${header}\n\n${table}`;
    await ctx.reply(text, { parse_mode: "HTML" });
  }

  /**
   * Ежедневные напоминания в ЛС тем, кто ещё не отметил явку на будущих репетициях.
   * В 10:00 по Москве бот отправляет каждому зарегистрированному пользователю список дат,
   * где он не стоит ни в «Присутствие», ни в «Отсутствие», ни в «Буду позже».
   */
  async sendAttendanceReminders() {
    // Получаем все репетиции
    const all = rehearsalStorage.getAllRehearsals();
    const entries = Object.entries(all || {});
    if (!entries.length) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Только сегодняшние и будущие репетиции
    const upcoming = entries
      .map(([dateKey, r]) => {
        const d = new Date(dateKey);
        if (Number.isNaN(d.getTime())) return null;
        return { dateKey, rehearsal: r, date: d };
      })
      .filter((x) => x && x.date >= today)
      .sort((a, b) => a.date - b.date);

    if (!upcoming.length) return;

    let users;
    try {
      users = await getUsersData();
    } catch (e) {
      console.error("sendAttendanceReminders: failed to load users:", e);
      return;
    }

    if (!Array.isArray(users) || users.length === 0) return;

    // Проходим по каждому пользователю и собираем список репетиций, где он ещё не отметился
    for (const user of users) {
      const tgId = user.telegram_id || user.telegramId || user.telegramId?.toString?.();
      if (!tgId) continue;
      const userIdStr = String(tgId);

      const missing = [];

      for (const { dateKey, rehearsal } of upcoming) {
        const attendance = rehearsalStorage.getAttendance(dateKey);
        if (!attendance || !attendance[userIdStr]) {
          missing.push(rehearsal);
        }
      }

      if (!missing.length) continue;

      const lines = [];
      lines.push(
        "<b>Напоминание о подтверждении явки</b>",
        "",
        "Вы ещё не отметились на следующих датах:",
      );
      missing.forEach((r) => {
        const placePart = r.place ? `, ${r.place}` : "";
        lines.push(`- ${r.dateDisplay} в ${r.time}${placePart}`);
      });
      lines.push(
        "",
        "Пожалуйста, нажмите кнопку в сообщении опроса в группе, чтобы подтвердить участие, отказаться или выбрать «Буду позже».",
      );

      const text = lines.join("\n");
      try {
        await this.bot.telegram.sendMessage(userIdStr, text, {
          parse_mode: "HTML",
        });
      } catch (e) {
        // Если пользователь запретил ЛС боту или другая ошибка — просто логируем и идём дальше
        if (e?.response?.error_code !== 403) {
          console.warn(
            "sendAttendanceReminders: failed to send reminder to",
            userIdStr,
            e.response?.description || e.message || e,
          );
        }
      }
    }
  }

  /**
   * Отправить опрос в группу по кнопке (после создания репетиции)
   */
  async handleSendToGroupCallback(ctx) {
    const match = ctx.match || [];
    const dateKey = match[1];
    try {
      await ctx.answerCbQuery();
    } catch (e) {
      console.error("answerCbQuery rehearsal_send_to_group:", e);
    }

    const groupChatId = this.getEffectiveGroupChatId();
    if (!groupChatId) {
      await ctx.reply(
        "Не задана группа для опросов. Задайте GROUP_CHAT_ID в .env (ID супергруппы с минусом, напр. -1001494331205) или используйте /setgroup.",
      );
      return;
    }

    try {
      await this.sendAttendanceMessage(dateKey);
      await ctx.reply("Опрос отправлен в группу.");
    } catch (error) {
      console.error("Ошибка при отправке опроса в группу:", error);
      const msg =
        error.response?.description ||
        error.message ||
        "Неизвестная ошибка Telegram API.";
      await ctx.reply(
        `Не удалось отправить опрос в группу: ${msg}. Проверьте GROUP_CHAT_ID (супергруппа с минусом) и что бот добавлен в группу.`,
      );
    }
  }

  /**
   * Публикация репетиции из backend (по rehearsalId).
   * Backend вызывает /internal/publish-rehearsal, а бот отправляет сообщение в группу и фиксирует published в БД.
   */
  async publishRehearsalFromBackend(rehearsalId) {
    const groupChatId = this.getEffectiveGroupChatId();
    const threadId = this.getEffectiveThreadId();

    if (!groupChatId) {
      throw new Error("Group chat is not configured (GROUP_CHAT_ID / /setgroup)");
    }

    const rehearsal = await orchestraBotApi.getRehearsal(rehearsalId);
    const title = escapeHtml(rehearsal?.title || "Репетиция");
    const startsAt = rehearsal?.startsAt ? formatRuDateTime(rehearsal.startsAt) : "";
    const place = rehearsal?.place ? `\n${escapeHtml(rehearsal.place)}` : "";
    const listText = this._formatBackendAttendanceList(rehearsal);

    const text = `<b>${title}</b>\n${escapeHtml(startsAt)}${place}\n\nПодтверждение присутствия\n\n${listText}`;

    const opts = { parse_mode: "HTML" };
    const tid = threadId != null && String(threadId).trim() !== "" ? parseInt(threadId, 10) : null;
    if (tid && !Number.isNaN(tid)) {
      opts.message_thread_id = tid;
    }

    const sent = await this.bot.telegram.sendMessage(
      groupChatId,
      text,
      Object.assign({}, opts, this._backendKeyboard(rehearsalId)),
    );

    await orchestraBotApi.markRehearsalPublished(rehearsalId, {
      chatId: String(sent.chat?.id),
      messageId: String(sent.message_id),
      threadId: opts.message_thread_id != null ? String(opts.message_thread_id) : undefined,
    });

    return sent;
  }

  _backendKeyboard(rehearsalId) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("Буду", `reh:${rehearsalId}:present`),
        Markup.button.callback("Не буду", `reh:${rehearsalId}:absent`),
        Markup.button.callback("Свое время", `reh:${rehearsalId}:late`),
      ],
    ]);
  }

  _formatBackendAttendanceList(rehearsal) {
    const participants = Array.isArray(rehearsal?.participants)
      ? rehearsal.participants
      : [];
    if (participants.length === 0) {
      return "Пока нет участников в репетиции.";
    }
    const lines = participants.map((p) => {
      const status = String(p?.status || "unknown");
      const email = escapeHtml(String(p?.email || "").trim() || "—");
      const name = escapeHtml(String(p?.userName || "").trim());
      const label = name ? `${name} · ${email}` : email;
      const lateTime = String(p?.lateTime || "").trim();
      const extra = status === "late" && lateTime ? ` (${escapeHtml(lateTime)})` : "";
      return `${statusIcon(status)} ${label}${extra}`;
    });
    return lines.join("\n");
  }

  /**
   * Публикация сборной сессии из backend (projectId + sessionId).
   * Backend вызывает /internal/publish-director-session, а бот отправляет сообщение в группу
   * и фиксирует published в rawJson через backend /bot/director-sessions/*.
   */
  async publishDirectorSessionFromBackend(projectId, sessionId) {
    const groupChatId = this.getEffectiveGroupChatId();
    const threadId = this.getEffectiveThreadId();

    if (!groupChatId) {
      throw new Error("Group chat is not configured (GROUP_CHAT_ID / /setgroup)");
    }

    const session = await orchestraBotApi.getDirectorSession(projectId, sessionId);
    const text = this._buildDirectorSessionText(session);

    const opts = { parse_mode: "HTML" };
    const tid =
      threadId != null && String(threadId).trim() !== "" ? parseInt(threadId, 10) : null;
    if (tid && !Number.isNaN(tid)) {
      opts.message_thread_id = tid;
    }

    const sent = await this.bot.telegram.sendMessage(
      groupChatId,
      text,
      Object.assign({}, opts, this._directorKeyboard(projectId, sessionId)),
    );

    await orchestraBotApi.markDirectorSessionPublished(projectId, sessionId, {
      chatId: String(sent.chat?.id),
      messageId: String(sent.message_id),
      threadId:
        opts.message_thread_id != null ? String(opts.message_thread_id) : undefined,
    });

    return sent;
  }

  _buildDirectorSessionText(session) {
    const title = escapeHtml(session?.title || "Сессия");
    const startsAt = session?.startsAt ? formatRuDateTime(session.startsAt) : "";
    const schedule = this._formatDirectorSchedule(session);
    const selected = this._formatDirectorSelectedMaterials(session);
    const invite = this._formatDirectorInviteList(session);
    const listText = this._formatBackendAttendanceList(session);
    return `<b>${title}</b>\n${escapeHtml(startsAt)}\n\nПлан репетиции\n${schedule}\n\nВыбрано на сегодня\n${selected}\n\nКого зовём\n${invite}\n\nПодтверждение присутствия\n\n${listText}`;
  }

  _directorKeyboard(projectId, sessionId) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("Буду", `ds:${projectId}:${sessionId}:present`),
        Markup.button.callback("Не буду", `ds:${projectId}:${sessionId}:absent`),
        Markup.button.callback("Свое время", `ds:${projectId}:${sessionId}:late`),
      ],
    ]);
  }

  _formatDirectorSchedule(session) {
    const slots = Array.isArray(session?.slots) ? session.slots : [];
    if (slots.length === 0) return "—";
    const sorted = [...slots].sort((a, b) => (a.offsetMin ?? 0) - (b.offsetMin ?? 0));
    const lines = sorted.slice(0, 60).map((s) => {
      const t1 = escapeHtml(String(s.timeStart ?? "").trim() || "");
      const t2 = escapeHtml(String(s.timeEnd ?? "").trim() || "");
      const t = t1 && t2 ? `${t1}–${t2}` : t1 || t2 || "";
      const p = escapeHtml(String(s.projectSlug ?? "").trim() || "");
      const id = s.stepId != null ? `#${escapeHtml(String(s.stepId))}` : "";
      const title = escapeHtml(String(s.stepTitle ?? "").trim());
      const notes = escapeHtml(String(s.notes ?? "").trim());
      const tail = [p, id, title].filter(Boolean).join(" ");
      const line = t ? `• ${t} — ${tail || "Материал"}` : `• ${tail || "Материал"}`;
      return notes ? `${line}\n  ↳ ${notes}` : line;
    });
    return lines.join("\n");
  }

  _formatDirectorSelectedMaterials(session) {
    const slots = Array.isArray(session?.slots) ? session.slots : [];
    if (slots.length === 0) return "—";
    const sorted = [...slots].sort((a, b) => (a.offsetMin ?? 0) - (b.offsetMin ?? 0));
    const uniq = new Set();
    const lines = [];
    for (const s of sorted) {
      const p = String(s.projectSlug ?? "").trim();
      const stepId = s.stepId != null ? String(s.stepId) : "";
      const title = String(s.stepTitle ?? "").trim();
      const key = `${p}:${stepId}:${title}`;
      if (!p || !stepId) continue;
      if (uniq.has(key)) continue;
      uniq.add(key);
      lines.push(`• ${escapeHtml([p, `#${stepId}`, title].filter(Boolean).join(" "))}`);
    }
    return lines.length ? lines.join("\n") : "—";
  }

  _formatDirectorInviteList(session) {
    const participants = Array.isArray(session?.participants)
      ? session.participants
      : [];
    if (participants.length === 0) return "—";
    const lines = participants.slice(0, 120).map((p) => {
      const email = escapeHtml(String(p?.email || "").trim() || "—");
      const name = escapeHtml(String(p?.userName || "").trim());
      const label = name ? `${name} · ${email}` : email;
      return `• ${label}`;
    });
    return lines.join("\n");
  }

  async handleBackendAttendanceCallback(ctx) {
    try {
      const data = String(ctx.callbackQuery?.data || "");
      const m = data.match(/^reh:([a-z0-9]+):(present|absent|late)$/i);
      if (!m) return;
      const rehearsalId = m[1];
      const status = m[2];

      const userName =
        (ctx.from?.username && String(ctx.from.username).trim()) ||
        [ctx.from?.first_name, ctx.from?.last_name]
          .map((x) => String(x || "").trim())
          .filter(Boolean)
          .join(" ")
          .trim() ||
        undefined;

      await orchestraBotApi.setRehearsalAttendance(rehearsalId, {
        telegramId: String(ctx.from.id),
        status,
        userName,
      });

      if (status === "late") {
        // Попросим время в личке и после ввода сохраним lateTime
        try {
          await this.bot.telegram.sendMessage(
            String(ctx.from.id),
            "Вы выбрали «Свое время». Напишите, к которому времени вы придёте (например: 20:00).\n\nОтмена: /cancel",
          );
          this.userStates.set(ctx.from.id, {
            step: "backend_attendance_late",
            data: { rehearsalId },
          });
        } catch (e) {
          const desc = e?.response?.description || "";
          const code = e?.response?.error_code;
          if (code === 403 && /can't initiate conversation with a user/i.test(desc)) {
            try {
              await ctx.answerCbQuery(
                "Я не могу написать вам в личку. Откройте чат со мной, нажмите /start и потом ещё раз нажмите «Свое время».",
                { show_alert: true },
              );
            } catch {}
          } else {
            console.error("Ошибка отправки ЛС для lateTime (backend):", e);
          }
        }
      }

      const rehearsal = await orchestraBotApi.getRehearsal(rehearsalId);
      const title = escapeHtml(rehearsal?.title || "Репетиция");
      const startsAt = rehearsal?.startsAt ? formatRuDateTime(rehearsal.startsAt) : "";
      const place = rehearsal?.place ? `\n${escapeHtml(rehearsal.place)}` : "";
      const listText = this._formatBackendAttendanceList(rehearsal);
      const text = `<b>${title}</b>\n${escapeHtml(startsAt)}${place}\n\nПодтверждение присутствия\n\n${listText}`;

      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        ...this._backendKeyboard(rehearsalId),
      });

      await ctx.answerCbQuery("Готово");
    } catch (e) {
      console.error("Backend attendance callback error:", e?.message || e);
      try {
        await ctx.answerCbQuery("Не удалось сохранить", { show_alert: false });
      } catch {}
    }
  }

  middleware() {
    return async (ctx, next) => {
      if (ctx.message?.text === undefined) return next();
      const handledBackendLate = await this.handleBackendLateMessage(ctx);
      if (handledBackendLate) return;
      const handledLate = await this.handleLateMessage(ctx);
      if (handledLate) return;
      const handledSetGroup = await this.handleSetGroupMessage(ctx);
      if (handledSetGroup) return;
      const handled = await this.handleSetRehearsalMessage(ctx);
      if (handled) return;
      return next();
    };
  }

  async handleDirectorSessionAttendanceCallback(ctx) {
    try {
      const data = String(ctx.callbackQuery?.data || "");
      const m = data.match(
        /^ds:([a-z0-9-]+):([a-z0-9-]+):(present|absent|late)$/i,
      );
      if (!m) return;
      const projectId = m[1];
      const sessionId = m[2];
      const status = m[3];

      const userName =
        (ctx.from?.username && String(ctx.from.username).trim()) ||
        [ctx.from?.first_name, ctx.from?.last_name]
          .map((x) => String(x || "").trim())
          .filter(Boolean)
          .join(" ")
          .trim() ||
        undefined;

      await orchestraBotApi.setDirectorSessionAttendance(projectId, sessionId, {
        telegramId: String(ctx.from.id),
        status,
        userName,
      });

      try {
        await ctx.answerCbQuery("Ок");
      } catch (_) {}

      // обновим сообщение (подтянем список заново)
      const session = await orchestraBotApi.getDirectorSession(projectId, sessionId);
      const text = this._buildDirectorSessionText(session);

      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        ...this._directorKeyboard(projectId, sessionId),
      });
    } catch (e) {
      console.error("handleDirectorSessionAttendanceCallback error:", e);
    }
  }

  init() {
    this.bot.use(this.middleware());

    this.bot.action(
      /^rehearsal_(\d{4}-\d{2}-\d{2})_(coming|not_coming|late)$/,
      async (ctx) => {
        await this.handleAttendanceCallback(ctx);
      },
    );

    // Новый формат: attendance для конкретной репетиции из Orchestra backend
    this.bot.action(/^reh:([a-z0-9]+):(present|absent|late)$/i, async (ctx) => {
      await this.handleBackendAttendanceCallback(ctx);
    });

    // Новый формат: attendance для сборной сессии (director sessions)
    this.bot.action(
      /^ds:([a-z0-9-]+):([a-z0-9-]+):(present|absent|late)$/i,
      async (ctx) => {
        await this.handleDirectorSessionAttendanceCallback(ctx);
      },
    );

    this.bot.action(
      /^rehearsal_send_to_group_(\d{4}-\d{2}-\d{2})$/,
      async (ctx) => {
        await this.handleSendToGroupCallback(ctx);
      },
    );

    // Автоотправка опроса по вторникам и пятницам в 12:00
    cron.schedule("0 12 * * 2,5", () => this.sendAttendanceMessage(), {
      timezone: "Europe/Moscow",
    });

    // Ежедневные напоминания в 10:00 тем, кто ещё не отметил явку
    cron.schedule(
      "0 10 * * *",
      () => {
        this.sendAttendanceReminders().catch((e) => {
          console.error("Attendance reminders error:", e);
        });
      },
      {
        timezone: "Europe/Moscow",
      },
    );

    console.log("Сервис явок на репетицию инициализирован.");
  }
}

module.exports = AttendanceService;
