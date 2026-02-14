/**
 * Обработчики административных команд
 */
const { Markup } = require("telegraf");

class AdminHandler {
  constructor(birthdayService) {
    this.birthdayService = birthdayService;
    this.adminIds = process.env.ADMIN_IDS
      ? process.env.ADMIN_IDS.split(",").map((id) => parseInt(id.trim()))
      : [];
  }

  /**
   * Проверяет, является ли пользователь администратором
   * @param {number} userId - Telegram ID пользователя
   * @returns {boolean} - true, если пользователь админ
   */
  isAdmin(userId) {
    return this.adminIds.includes(userId);
  }

  /**
   * Обработчик команды проверки дней рождения
   */
  async checkBirthdays(ctx) {
    const userId = ctx.from.id;

    // Проверяем, что пользователь является администратором
    if (!this.isAdmin(userId)) {
      console.log(`Non-admin user ${userId} tried to access admin command`);
      return ctx.reply("У вас нет прав для выполнения этой команды.");
    }

    try {
      await ctx.reply("Запускаю проверку дней рождения...");

      // Запускаем проверку
      await this.birthdayService.manualCheck();

      await ctx.reply("Проверка завершена. Результаты отправлены в консоль.");
    } catch (error) {
      console.error("Error in manual birthday check:", error);
      await ctx.reply("Произошла ошибка при проверке дней рождения.");
    }
  }
}

module.exports = AdminHandler;
