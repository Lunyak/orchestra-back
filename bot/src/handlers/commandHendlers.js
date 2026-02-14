const { COMMANDS } = require("../config/commandsConfig");

/**
 * Формирует текст для /help: список команд с полными описаниями.
 * @param {Object} [ctx] - Контекст Telegraf; если передан, для не-организатора скрываются команды с adminOnly.
 */
function getHelpMessage(ctx) {
  const ownerId = process.env.OWNER_TELEGRAM_ID;
  const isOwner =
    ctx?.from?.id != null && ownerId && String(ctx.from.id) === String(ownerId);
  const list = isOwner ? COMMANDS : COMMANDS.filter((c) => !c.adminOnly);

  const lines = ["<b>🎭 Команды бота</b>", "", "Кратко о каждой команде:", ""];

  for (const { command, longDescription } of list) {
    lines.push(`<b>/${command}</b>`);
    lines.push(`   ${longDescription}`);
    lines.push("");
  }

  lines.push(
    "Подсказки по командам также видны в меню бота (кнопка «/» рядом с полем ввода).",
  );
  return lines.join("\n");
}

module.exports = {
  COMMANDS,
  getHelpMessage,
  init: async (bot) => {
    try {
      const toMenu = (list) =>
        list.map(({ command, shortDescription }) => ({
          command,
          description: shortDescription,
        }));

      const publicCommands = toMenu(COMMANDS.filter((c) => !c.adminOnly));
      await bot.telegram.setMyCommands(publicCommands);

      const ownerId = process.env.OWNER_TELEGRAM_ID;
      if (ownerId) {
        const allCommands = toMenu(COMMANDS);
        await bot.telegram.setMyCommands(allCommands, {
          scope: { type: "chat", chat_id: parseInt(ownerId, 10) },
        });
      }
      console.log("Команды бота успешно установлены");
    } catch (error) {
      console.error("Ошибка при настройке команд:", error);
    }
  },
};
