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

// Telegram callback_data limit is 64 bytes.
// Director session IDs are UUID v4 (36 chars with hyphens), which when combined
// with projectId (CUID, 25 chars), prefix and status exceed the limit.
// Solution: strip UUID hyphens (36→32 chars) and use single-char status codes.
function compactUuid(id) {
  return String(id || "").replace(/-/g, "");
}

function expandUuid(compact) {
  const s = String(compact || "");
  if (s.length === 32 && /^[0-9a-f]+$/i.test(s)) {
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  }
  return s;
}

const DS_STATUS_COMPACT = { present: "p", absent: "a", late: "l" };
const DS_STATUS_EXPAND = { p: "present", a: "absent", l: "late" };

const DEFAULT_TZ = process.env.BOT_TIMEZONE || "Europe/Moscow";

function formatRuDateTime(iso, timeZone = DEFAULT_TZ) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso || "");
    // Do not depend on server/container timezone (often UTC).
    // Always format explicitly in a target timezone (default: Europe/Moscow).
    const parts = new Intl.DateTimeFormat("ru-RU", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const byType = (t) => parts.find((p) => p.type === t)?.value || "";
    const dd = byType("day");
    const mm = byType("month");
    const yyyy = byType("year");
    const hh = byType("hour");
    const min = byType("minute");
    if (!dd || !mm || !yyyy || !hh || !min) return String(iso || "");
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
    // Важно: НЕ задаём дефолтный threadId. Иначе бот может "успешно" отправлять
    // сообщения в неожиданный топик, и будет казаться, что публикации нет.
    return (
      settingsStorage.getAttendanceThreadId() ||
      process.env.GROUP_CHAT_ID_ATTENTION ||
      process.env.ATTENDANCE_THREAD_ID ||
      null
    );
  }

  /**
   * Топик для director-sessions. message_thread_id — только положительное число.
   * Нельзя подставлять chat_id (например -1494331205) — Telegram отклонит отправку.
   */
  getEffectiveDirectorSessionsThreadId() {
    return (
      this._normalizeTopicThreadId(process.env.DIRECTOR_SESSIONS_THREAD_ID) ||
      this._normalizeTopicThreadId(process.env.ANNOUNCEMENTS_THREAD_ID) ||
      null
    );
  }

  /** Forum topic id: только целое > 0. */
  _normalizeTopicThreadId(raw) {
    const s = String(raw ?? "").trim();
    if (!s) return null;
    if (!/^\d+$/.test(s)) return null;
    const n = parseInt(s, 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    return String(n);
  }

  _isMissingForumThreadError(error) {
    const desc = String(error?.response?.description || error?.message || "");
    return /message thread not found|topic not found|THREAD_DELETED|topic closed/i.test(
      desc,
    );
  }

  async _sendGroupMessage(chatId, text, extra = {}) {
    try {
      return await this.bot.telegram.sendMessage(chatId, text, extra);
    } catch (error) {
      const threadId = extra?.message_thread_id;
      if (threadId == null || !this._isMissingForumThreadError(error)) {
        throw error;
      }
      console.warn(
        "[telegram] forum thread missing, sending without message_thread_id",
        "chatId=",
        chatId,
        "threadId=",
        threadId,
      );
      const retryExtra = { ...extra };
      delete retryExtra.message_thread_id;
      return await this.bot.telegram.sendMessage(chatId, text, retryExtra);
    }
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
      await this.sendScheduledOrchestraCalls();
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
      await this.sendScheduledOrchestraCalls();
      await ctx.reply(
        "Проверил сессии и репетиции Orchestra и отправил положенные вызовы.",
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
   * @deprecated «Свое время» отключено — оставляем no-op на случай старых userStates.
   */
  async handleBackendLateMessage(ctx) {
    if (ctx.chat?.type !== "private") return false;
    const userId = ctx.from?.id;
    const state = this.userStates.get(userId);
    if (!state || state.step !== "backend_attendance_late") return false;
    this.userStates.delete(userId);
    await ctx.reply("Вариант «Свое время» больше не используется. Отметьтесь «Буду» или «Не буду» в сообщении репетиции.");
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
    // Prefer integration settings from backend (persistent, per-bot),
    // fallback to local settingsStorage/env for backwards compatibility.
    const integration = await orchestraBotApi.getIntegration().catch(() => null);
    const groupChatId = normalizeSupergroupId(
      String(integration?.groupChatId || "").trim() || this.getEffectiveGroupChatId(),
    );
    const threadId =
      (integration?.attendanceThreadId != null &&
      String(integration.attendanceThreadId).trim() !== ""
        ? String(integration.attendanceThreadId).trim()
        : null) || this.getEffectiveThreadId();

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

    // If already published, try to update existing message.
    const chatId = rehearsal?.telegramChatId != null ? String(rehearsal.telegramChatId).trim() : "";
    const messageIdRaw =
      rehearsal?.telegramMessageId != null ? String(rehearsal.telegramMessageId).trim() : "";
    const messageId = messageIdRaw && /^\d+$/.test(messageIdRaw) ? parseInt(messageIdRaw, 10) : null;
    if (chatId && messageId) {
      try {
        await this.bot.telegram.editMessageText(chatId, messageId, undefined, text, {
          parse_mode: "HTML",
          ...this._backendKeyboard(rehearsalId),
        });
        return { ok: true, updated: true };
      } catch (e) {
        const desc = e?.response?.description || "";
        // If message was deleted or can't be edited, we'll send a new one below.
        if (
          e?.response?.error_code === 400 &&
          /message to edit not found|message identifier is not specified|message can't be edited/i.test(
            desc,
          )
        ) {
          // continue to send new message
        } else if (
          e?.response?.error_code === 400 &&
          /message is not modified/i.test(desc)
        ) {
          return { ok: true, updated: true };
        } else {
          console.error("publishRehearsalFromBackend edit failed:", e?.message || e);
          // continue to send new message as fallback
        }
      }
    }

    const sent = await this._sendGroupMessage(
      groupChatId,
      text,
      Object.assign({}, opts, this._backendKeyboard(rehearsalId)),
    );

    await orchestraBotApi.markRehearsalPublished(rehearsalId, {
      chatId: String(sent.chat?.id),
      messageId: String(sent.message_id),
      threadId:
        sent.message_thread_id != null
          ? String(sent.message_thread_id)
          : undefined,
    });

    return sent;
  }

  _backendKeyboard(rehearsalId) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("Буду", `reh:${rehearsalId}:present`),
        Markup.button.callback("Не буду", `reh:${rehearsalId}:absent`),
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
      const label = this._formatTelegramPersonLabel(p);
      return `${statusIcon(status)} ${label}`;
    });
    return lines.join("\n");
  }

  /** Имя с кликабельным mention по telegramId; email не показываем. */
  _formatTelegramPersonLabel(person) {
    const name = escapeHtml(
      String(person?.userName || "").trim() || "Участник",
    );
    const telegramId = String(person?.telegramId ?? "").trim();
    if (telegramId && /^\d+$/.test(telegramId)) {
      return `<a href="tg://user?id=${telegramId}">${name}</a>`;
    }
    return name;
  }

  /**
   * Публикация сборной сессии из backend (projectId + sessionId).
   * Backend вызывает /internal/publish-director-session, а бот отправляет сообщение в группу
   * и фиксирует published в rawJson через backend /bot/director-sessions/*.
   */
  async publishDirectorSessionFromBackend(projectId, sessionId) {
    // Prefer integration settings from backend (persistent, per-bot),
    // fallback to local settingsStorage/env for backwards compatibility.
    const integration = await orchestraBotApi.getIntegration().catch(() => null);
    const groupChatId = normalizeSupergroupId(
      String(integration?.groupChatId || "").trim() || this.getEffectiveGroupChatId(),
    );
    const threadId =
      (integration?.announcementsThreadId != null &&
      String(integration.announcementsThreadId).trim() !== ""
        ? String(integration.announcementsThreadId).trim()
        : null) || this.getEffectiveDirectorSessionsThreadId();

    if (!groupChatId) {
      throw new Error("Group chat is not configured (GROUP_CHAT_ID / /setgroup)");
    }

    const session = await orchestraBotApi.getDirectorSession(projectId, sessionId);
    const text = this._buildDirectorSessionText(session);

    const opts = { parse_mode: "HTML" };
    const resolvedThreadId =
      this._normalizeTopicThreadId(threadId) ||
      this.getEffectiveDirectorSessionsThreadId();
    if (resolvedThreadId) {
      opts.message_thread_id = parseInt(resolvedThreadId, 10);
    }

    console.log(
      "[director-session] publish",
      "projectId=",
      projectId,
      "sessionId=",
      sessionId,
      "chatId=",
      groupChatId,
      "threadId=",
      opts.message_thread_id ?? null,
      "rawThreadId=",
      threadId ?? null,
    );

    // If already published, try to update existing message instead of a new ping.
    const prevChatId =
      session?.telegramChatId != null ? String(session.telegramChatId).trim() : "";
    const prevMessageIdRaw =
      session?.telegramMessageId != null
        ? String(session.telegramMessageId).trim()
        : "";
    const prevMessageId =
      prevMessageIdRaw && /^\d+$/.test(prevMessageIdRaw)
        ? parseInt(prevMessageIdRaw, 10)
        : null;

    if (prevChatId && prevMessageId) {
      try {
        await this.bot.telegram.editMessageText(
          prevChatId,
          prevMessageId,
          undefined,
          text,
          {
            parse_mode: "HTML",
            ...this._directorKeyboard(projectId, sessionId),
          },
        );
        return { ok: true, updated: true };
      } catch (e) {
        const desc = e?.response?.description || "";
        if (
          e?.response?.error_code === 400 &&
          /message is not modified/i.test(desc)
        ) {
          return { ok: true, updated: true };
        }
        console.error(
          "[director-session] edit failed, sending new message",
          e?.message || e,
        );
      }
    }

    let sent;
    try {
      sent = await this._sendGroupMessage(
        groupChatId,
        text,
        Object.assign({}, opts, this._directorKeyboard(projectId, sessionId)),
      );
    } catch (e) {
      console.error(
        "[director-session] sendMessage failed",
        "chatId=",
        groupChatId,
        "threadId=",
        opts.message_thread_id ?? null,
        e?.response?.description || e?.message || e,
      );
      throw e;
    }

    await orchestraBotApi.markDirectorSessionPublished(projectId, sessionId, {
      chatId: String(sent.chat?.id),
      messageId: String(sent.message_id),
      threadId:
        sent.message_thread_id != null
          ? String(sent.message_thread_id)
          : undefined,
    });

    if (prevChatId && prevMessageId) {
      try {
        await this.bot.telegram.deleteMessage(prevChatId, prevMessageId);
      } catch (e) {
        // ignore: message may already be gone or too old to delete
      }
    }

    return sent;
  }

  async sendScheduledOrchestraCalls() {
    const data = await orchestraBotApi.listUpcomingCalls().catch((e) => {
      console.error("listUpcomingCalls failed:", e?.message || e);
      return null;
    });
    const items = Array.isArray(data?.items) ? data.items : [];
    for (const item of items) {
      const kind = String(item?.kind || "").trim();
      const id = String(item?.id || "").trim();
      if (!id) continue;
      try {
        if (kind === "director-session") {
          const projectId = String(item?.projectId || "").trim();
          if (!projectId) continue;
          await this.publishDirectorSessionFromBackend(projectId, id);
        } else if (kind === "rehearsal") {
          await this.publishRehearsalFromBackend(id);
        }
      } catch (e) {
        console.error("sendScheduledOrchestraCalls item failed:", kind, id, e?.message || e);
      }
    }
    return { ok: true, count: items.length };
  }

  async sendMonthAvailabilityReminders(force = false) {
    const data = await orchestraBotApi.listAvailabilityGaps().catch((e) => {
      console.error("listAvailabilityGaps failed:", e?.message || e);
      return null;
    });
    if (!force && !data?.enabled) return { ok: true, sentCount: 0, skipped: true };
    const recipients = Array.isArray(data?.items) ? data.items : [];
    return this.remindMonthAvailabilityFromBackend(recipients);
  }

  async remindMonthAvailabilityFromBackend(recipients) {
    const list = Array.isArray(recipients) ? recipients.slice(0, 500) : [];
    if (list.length === 0) {
      return { ok: true, sentCount: 0, failedCount: 0 };
    }
    let sentCount = 0;
    let failedCount = 0;
    for (const item of list) {
      const telegramId = String(item?.telegramId || "").trim();
      if (!telegramId) {
        failedCount += 1;
        continue;
      }
      const missingDays = Number(item?.missingDays || 0) || 0;
      const name = String(item?.name || "").trim();
      const hello = name ? `${name}, ` : "";
      const text = [
        `${hello}на ближайший месяц занятость заполнена не полностью.`,
        missingDays > 0 ? `Нет отметки на ${missingDays} дн.` : "",
        "Отметьте свободные и занятые дни в графике коллектива театра или проекта в Orchestra, чтобы вызов не приходил вслепую.",
      ]
        .filter(Boolean)
        .join("\n");
      try {
        await this.bot.telegram.sendMessage(telegramId, text);
        sentCount += 1;
      } catch (e) {
        failedCount += 1;
        console.error(
          "remindMonthAvailabilityFromBackend failed:",
          telegramId,
          e?.message || e,
        );
      }
    }
    return { ok: true, sentCount, failedCount };
  }

  async remindDirectorSessionMissingAvailabilityFromBackend(
    projectId,
    sessionId,
    recipients,
  ) {
    const list = Array.isArray(recipients) ? recipients.slice(0, 500) : [];
    if (list.length === 0) {
      return { ok: true, sentCount: 0, failedCount: 0 };
    }

    const session = await orchestraBotApi
      .getDirectorSession(projectId, sessionId)
      .catch(() => null);
    const sessionTitle = String(session?.title || "Сессия").trim() || "Сессия";
    const startsAt = session?.startsAt ? formatRuDateTime(session.startsAt) : "";
    const baseText = [
      `Напоминание по сессии «${sessionTitle}».`,
      startsAt ? `Дата: ${startsAt}.` : "",
      "Пожалуйста, отметьте занятость на этот день в графике коллектива театра или проекта в Orchestra.",
    ]
      .filter(Boolean)
      .join("\n");

    let sentCount = 0;
    let failedCount = 0;
    for (const item of list) {
      const telegramId = String(item?.telegramId || "").trim();
      if (!telegramId) {
        failedCount += 1;
        continue;
      }
      try {
        await this.bot.telegram.sendMessage(telegramId, baseText);
        sentCount += 1;
      } catch (e) {
        failedCount += 1;
        console.error(
          "remindDirectorSessionMissingAvailabilityFromBackend failed:",
          telegramId,
          e?.message || e,
        );
      }
    }
    return { ok: true, sentCount, failedCount };
  }

  _buildDirectorSessionText(session) {
    const title = escapeHtml(session?.title || "Сессия");
    const commentRaw = String(session?.comment || "").trim();
    const comment =
      commentRaw.length > 0
        ? commentRaw.length > 1200
          ? `${commentRaw.slice(0, 1200)}…`
          : commentRaw
        : "";
    const commentBlock = comment ? `\n\nКомментарий\n${escapeHtml(comment)}` : "";
    const schedule = this._formatDirectorSchedule(session);
    const invite = this._formatDirectorInviteList(session);
    const listText = this._formatBackendAttendanceList(session);
    const sessionLink = this._formatDirectorSessionLink(session);
    return `<b>${title}</b>${commentBlock}\n\nПлан репетиции\n${schedule}\n\nВызываются\n${invite}\n\nПодтверждение присутствия\n\n${listText}${sessionLink}`;
  }

  _formatDirectorSessionLink(session) {
    const sessionUrl = String(session?.sessionUrl ?? "").trim();
    if (!sessionUrl) return "";
    const label = escapeHtml(String(session?.title ?? "").trim() || "Репетиция");
    return `\n\nОткрыть репетицию\n<a href="${sessionUrl}">${label}</a>`;
  }

  _directorKeyboard(projectId, sessionId) {
    // Strip UUID hyphens so callback_data stays within Telegram's 64-byte limit.
    // Format: ds:<projectId(25)>:<sessionId_no_dashes(32)>:<status_char(1)> = 63 bytes max.
    const sid = compactUuid(sessionId);
    return Markup.inlineKeyboard([
      [
        Markup.button.callback("Буду", `ds:${projectId}:${sid}:${DS_STATUS_COMPACT.present}`),
        Markup.button.callback("Не буду", `ds:${projectId}:${sid}:${DS_STATUS_COMPACT.absent}`),
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
      const sceneTitleRaw = String(s.stepTitle ?? "").trim();
      const sceneTitle = escapeHtml(sceneTitleRaw);
      const sceneUrl = String(s.sceneUrl ?? "").trim();
      const sceneLabel =
        sceneTitleRaw && sceneUrl
          ? `<a href="${sceneUrl}">${sceneTitle}</a>`
          : sceneTitle;
      const projectLabel = escapeHtml(
        String(s.projectName ?? "").trim() ||
          String(s.projectSlug ?? "").trim() ||
          "",
      );
      const notes = escapeHtml(String(s.notes ?? "").trim());
      let material = "Материал";
      if (sceneLabel && projectLabel) {
        material = `${sceneLabel} [${projectLabel}]`;
      } else if (sceneLabel) {
        material = sceneLabel;
      } else if (projectLabel) {
        material = `[${projectLabel}]`;
      }
      const line = t ? `• ${t} — ${material}` : `• ${material}`;
      return notes ? `${line}\n  ↳ ${notes}` : line;
    });
    return lines.join("\n");
  }

  _formatDirectorInviteList(session) {
    const participants = Array.isArray(session?.participants)
      ? session.participants
      : [];
    if (participants.length === 0) return "—";
    const sorted = [...participants].sort((a, b) => {
      const ta = String(a?.callTime ?? "").trim();
      const tb = String(b?.callTime ?? "").trim();
      if (ta && tb) return ta.localeCompare(tb);
      if (ta) return -1;
      if (tb) return 1;
      const nameA = String(a?.userName ?? a?.firstName ?? a?.email ?? "").trim();
      const nameB = String(b?.userName ?? b?.firstName ?? b?.email ?? "").trim();
      return nameA.localeCompare(nameB, "ru");
    });
    const lines = sorted.slice(0, 120).map((p) => {
      const label = this._formatTelegramPersonLabel(p);
      const callTime = escapeHtml(String(p?.callTime ?? "").trim());
      return callTime ? `• ${callTime} — ${label}` : `• ${label}`;
    });
    return lines.join("\n");
  }

  async handleBackendAttendanceCallback(ctx) {
    try {
      const data = String(ctx.callbackQuery?.data || "");
      const m = data.match(/^reh:([a-z0-9]+):(present|absent|late)$/i);
      if (!m) return;
      const rehearsalId = m[1];
      const status = m[2].toLowerCase();

      if (status === "late") {
        try {
          await ctx.answerCbQuery(
            "Вариант «Свое время» больше не используется. Выберите «Буду» или «Не буду».",
            { show_alert: true },
          );
        } catch {}
        return;
      }

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
      // Compact format: ds:<projectId>:<sessionId_no_dashes>:<p|a|l>
      const m = data.match(/^ds:([a-z0-9]+):([a-z0-9]+):(p|a|l)$/i);
      if (!m) return;
      const projectId = m[1];
      const sessionId = expandUuid(m[2]); // restore UUID hyphens if needed
      const status = DS_STATUS_EXPAND[m[3].toLowerCase()] || m[3];

      if (status === "late") {
        try {
          await ctx.answerCbQuery(
            "Вариант «Свое время» больше не используется. Выберите «Буду» или «Не буду».",
            { show_alert: true },
          );
        } catch (_) {}
        return;
      }

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
    // Compact: ds:<projectId>:<sessionId_no_dashes>:<p|a|l>
    this.bot.action(
      /^ds:([a-z0-9]+):([a-z0-9]+):(p|a|l)$/i,
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

    // Автоотправка вызовов по расписанию бота (сессии и репетиции Orchestra)
    cron.schedule(
      "5 * * * *",
      () => {
        this.sendScheduledOrchestraCalls().catch((e) => {
          console.error("Scheduled orchestra calls error:", e);
        });
      },
      { timezone: "Europe/Moscow" },
    );

    // Напоминания в личку, если занятость на месяц не заполнена
    cron.schedule(
      "0 10 * * 1",
      () => {
        this.sendMonthAvailabilityReminders().catch((e) => {
          console.error("Month availability reminders error:", e);
        });
      },
      { timezone: "Europe/Moscow" },
    );

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
