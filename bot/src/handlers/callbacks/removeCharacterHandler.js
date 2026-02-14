const { Markup } = require("telegraf");
const { updateUserData } = require("../../api/userApi");

module.exports = async (ctx, userStates) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);

  console.log(`[removeCharacter] Starting for user ${userId}`);
  console.log(`[removeCharacter] Current state:`, state);

  if (!state || !state.user) {
    console.log(`[removeCharacter] No state or user found for ${userId}`);
    return ctx.reply(
      "Ошибка: данные пользователя не найдены. Попробуйте зарегистрироваться командой /register."
    );
  }

  // Обработка callback query для выбора роли
  if (ctx.callbackQuery) {
    const data = ctx.callbackQuery.data;
    console.log(`[removeCharacter] Callback data: ${data}`);

    if (data === "cancel_remove") {
      console.log(`[removeCharacter] Canceling removal`);
      await ctx.answerCbQuery("Отменено");
      await ctx.editMessageText("Удаление роли отменено ✅");
      userStates.delete(userId);
      return;
    }

    if (data.startsWith("remove_character_")) {
      const characterToRemove = data.replace("remove_character_", "");
      console.log(`[removeCharacter] Removing character: ${characterToRemove}`);

      const userRoles = state.user.characters || [];
      const updatedRoles = userRoles.filter(
        (role) => role !== characterToRemove
      );

      console.log(`[removeCharacter] Original roles:`, userRoles);
      console.log(`[removeCharacter] Updated roles:`, updatedRoles);

      try {
        console.log(`[removeCharacter] Calling API to update user ${userId}`);
        await ctx.answerCbQuery("Удаление...");

        await updateUserData(userId, {
          characters: updatedRoles,
        });

        console.log(`[removeCharacter] API call successful`);
        await ctx.editMessageText(
          `🗑 Роль "${characterToRemove}" удалена успешно!`
        );
      } catch (err) {
        console.error(`[removeCharacter] Error:`, err);
        await ctx.answerCbQuery("Ошибка");
        await ctx.editMessageText(
          "Ошибка при удалении роли. Пожалуйста, попробуйте позже."
        );
      }

      console.log(`[removeCharacter] Cleaning up state for ${userId}`);
      userStates.delete(userId);
      return;
    }
  }

  // Первый запуск: отображаем роли
  const userCharacters = state.user.characters || [];

  if (userCharacters.length === 0) {
    return ctx.reply("У тебя нет ролей, которые можно удалить.");
  }

  userStates.set(userId, {
    step: "removeCharacter_select",
    user: state.user || {},
  });

  // Создаем инлайн клавиатуру с ролями
  const inlineKeyboard = [
    ...userCharacters.map((character) => [
      Markup.button.callback(character, `remove_character_${character}`),
    ]),
    [Markup.button.callback("Отмена", "cancel_remove")],
  ];

  return ctx.reply(
    "Выбери роль, которую хочешь удалить:",
    Markup.inlineKeyboard(inlineKeyboard)
  );
};
