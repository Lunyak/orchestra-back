/**
 * Обработка ошибок
 * @param {Object} ctx - Контекст Telegraf
 * @param {Error} error - Ошибка
 * @param {string} action - Действие, при котором произошла ошибка
 */

module.exports = async (ctx, error, action) => {
  console.error(`Ошибка при ${action}:`, error);
  await ctx.reply("Произошла ошибка. Пожалуйста, попробуйте позже.");
};
