const {
  findBirthdayPeople,
  calculateAge,
  getAllBirthdaysSorted,
  formatDateShort,
} = require("../utils/birthdayUtils");
const settingsStorage = require("./settingsStorage");
const { normalizeSupergroupId } = require("../utils/telegramUtils");

/**
 * Сервис для поздравления пользователей с днем рождения
 */
class BirthdayService {
  constructor(bot) {
    this.bot = bot;
    this.initialized = false;

    // Массив шаблонов поздравлений
    this.birthdayMessages = [
      "🎉 С Днем Рождения, {name}! Желаем творческих успехов и вдохновения! 🎭",
      "🎂 Поздравляем с Днем Рождения, {name}! Пусть каждое выступление будет аплодисментами! 👏",
      "🥳 С Днем Рождения, {name}! Желаем новых интересных ролей и громких оваций! 🎬",
      "🎊 {name}, поздравляем тебя с Днем Рождения! Твой талант достоин самых больших сцен! 🎪",
      "🎈 С Днем Рождения, {name}! Пусть твои творческие замыслы всегда воплощаются в жизнь! ✨",
    ];
  }

  /**
   * Инициализирует сервис
   */
  init() {
    if (this.initialized) return;

    // Устанавливаем ежедневную проверку в 10:00 утра
    this.scheduleCheck();
    this.initialized = true;
  }

  /**
   * Планирует ежедневную проверку дней рождения
   */
  scheduleCheck() {
    // Получаем текущее время
    const now = new Date();

    // Устанавливаем время следующей проверки на 10:00 утра
    let nextCheck = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      10,
      0,
      0,
    );

    // Если сейчас уже после 10 утра, переносим на завтра
    if (now > nextCheck) {
      nextCheck.setDate(nextCheck.getDate() + 1);
    }

    // Вычисляем задержку в миллисекундах
    const delay = nextCheck.getTime() - now.getTime();

    // Планируем первую проверку
    setTimeout(() => {
      this.checkBirthdays();

      // Устанавливаем регулярную проверку каждые 24 часа
      setInterval(() => this.checkBirthdays(), 24 * 60 * 60 * 1000);
    }, delay);

    console.log(
      `Next birthday check scheduled at ${nextCheck.toLocaleString()}`,
    );
  }

  /**
   * Проверяет наличие именинников и отправляет поздравления
   */
  async checkBirthdays() {
    console.log("Проверяем дни рождения...");

    try {
      const birthdayPeople = await findBirthdayPeople();

      if (birthdayPeople?.length === 0) {
        console.log("Сегодня нет именинников");
        return;
      }

      console.log(`Найдено ${birthdayPeople.length} именинников`);

      // Отправляем поздравления каждому имениннику
      for (const person of birthdayPeople) {
        await this.sendBirthdayWish(person);
      }

      // Отправляем уведомление в группу
      await this.sendGroupNotification(birthdayPeople);
    } catch (error) {
      console.error("Ошибка при проверке дней рождения:", error);
    }
  }

  /**
   * Отправляет поздравление конкретному пользователю
   * @param {Object} user - Пользователь-именинник
   */
  async sendBirthdayWish(user) {
    console.log(user);

    if (!user.telegram_id) {
      console.log(`Cannot send birthday wish to ${user.name}: no Telegram ID`);
      return;
    }

    try {
      // Выбираем случайное поздравление
      const messageTemplate =
        this.birthdayMessages[
          Math.floor(Math.random() * this.birthdayMessages.length)
        ];

      // Подставляем имя в шаблон
      const message = messageTemplate.replace("{name}", user.name);

      // Добавляем возраст если доступен
      const age = calculateAge(user.birthDate);
      const ageMessage = age
        ? `\n\nТебе сегодня исполняется ${age} ${this.getYearWord(age)}! 🎂`
        : "";

      // Отправляем личное поздравление
      await this.bot.telegram.sendMessage(
        user.telegram_id,
        message + ageMessage,
        { parse_mode: "HTML" },
      );

      console.log(`Sent birthday wish to ${user.name} (${user.telegramId})`);
    } catch (error) {
      console.error(`Failed to send birthday wish to ${user.name}:`, error);
    }
  }

  /**
   * Отправляет уведомление о днях рождения в групповой чат
   * @param {Array} birthdayPeople - Список именинников
   */
  async sendGroupNotification(birthdayPeople) {
    try {
      let groupChatId =
        settingsStorage.getGroupChatId() || process.env.GROUP_CHAT_ID;
      groupChatId = normalizeSupergroupId(groupChatId);
      const threadId =
        settingsStorage.getAnnouncementsThreadId() ||
        process.env.GROUP_CHAT_ID_ATTENTION ||
        process.env.ANNOUNCEMENTS_THREAD_ID;

      if (!groupChatId) {
        console.log(
          "Группа не задана (используйте /setgroup или GROUP_CHAT_ID_ATTENTION), пропускаем групповое уведомление",
        );
        return;
      }

      const names = birthdayPeople.map((p) => p.name).join(", ");
      let message = `🎉 <b>Сегодня день рождения празднуют:</b> ${names}! 🎂\n\n`;
      message += "Не забудьте поздравить! 🎊";

      const opts = { parse_mode: "HTML" };
      if (threadId) opts.message_thread_id = parseInt(threadId, 10);

      await this.bot.telegram.sendMessage(groupChatId, message, opts);

      console.log("Групповое уведомление отправлено в тему 'Объявления'");
    } catch (error) {
      console.error("Ошибка при отправке группового уведомления:", error);
    }
  }

  /**
   * Склоняет слово "год" в зависимости от числа
   * @param {number} age - Возраст
   * @returns {string} - Правильно склоненное слово
   */
  getYearWord(age) {
    const lastDigit = age % 10;
    const lastTwoDigits = age % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
      return "лет";
    }

    if (lastDigit === 1) {
      return "год";
    }

    if (lastDigit >= 2 && lastDigit <= 4) {
      return "года";
    }

    return "лет";
  }

  /**
   * Ручная проверка дней рождения (для тестирования)
   */
  async manualCheck() {
    console.log("Manual birthday check initiated");
    await this.checkBirthdays();
  }

  /**
   * Показывает таблицу всех участников и их дней рождения (от ближайшего к дальнему)
   */
  async showBirthdaysTable(ctx) {
    try {
      const list = await getAllBirthdaysSorted();

      if (list.length === 0) {
        await ctx.reply("Нет данных о днях рождения участников.");
        return;
      }

      const maxNameLen = Math.max(4, ...list.map((u) => u.name.length));
      const birthColLen = 10;
      const nextColLen = 6;
      const headerName = "Имя".padEnd(maxNameLen);
      const headerBirth = "ДР".padEnd(birthColLen);
      const headerNext = "Ближайший".padEnd(nextColLen);
      const headerDays = "Через";

      const headerLine = `${headerName}  ${headerBirth}  ${headerNext}  ${headerDays}`;
      const sepLine = "—".repeat(Math.min(headerLine.length, 60));

      const lines = [
        headerLine,
        sepLine,
        ...list.map((u) => {
          const birthStr = formatBirthdayForTable(u.birthday);
          const nextStr = formatDateShort(u.nextDate);
          const daysStr =
            u.daysUntil === 0
              ? "сегодня"
              : u.daysUntil === 1
                ? "завтра"
                : `${u.daysUntil} дн.`;
          return `${u.name.padEnd(maxNameLen)}  ${birthStr.padEnd(birthColLen)}  ${nextStr.padEnd(nextColLen)}  ${daysStr}`;
        }),
      ];

      const text = lines.join("\n");
      const maxLen = 4000;
      if (text.length <= maxLen) {
        await ctx.reply(`<pre>${escapeHtml(text)}</pre>`, {
          parse_mode: "HTML",
        });
      } else {
        const headerAndSep = lines.slice(0, 2).join("\n");
        let chunk = headerAndSep + "\n";
        for (let i = 2; i < lines.length; i++) {
          if (chunk.length + lines[i].length + 1 > maxLen) {
            await ctx.reply(`<pre>${escapeHtml(chunk)}</pre>`, {
              parse_mode: "HTML",
            });
            chunk = headerAndSep + "\n" + lines[i] + "\n";
          } else {
            chunk += lines[i] + "\n";
          }
        }
        if (chunk.trim()) {
          await ctx.reply(`<pre>${escapeHtml(chunk.trim())}</pre>`, {
            parse_mode: "HTML",
          });
        }
      }
    } catch (error) {
      console.error("Ошибка при формировании таблицы дней рождения:", error);
      await ctx.reply("Не удалось загрузить список дней рождения.");
    }
  }
}

function formatBirthdayForTable(birthday) {
  if (!birthday) return "—";
  const s = String(birthday).trim();
  if (s.length <= 10) return s;
  return s.slice(0, 10);
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = BirthdayService;
