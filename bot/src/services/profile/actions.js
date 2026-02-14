const editProfileHandler = require("./handlers/editProfileHandler");
const roleHendlers = require("./handlers/roleHandler");

module.exports = (bot, userStates) => {
  // Согласие на обработку персональных данных при регистрации
  bot.action("register_consent_yes", async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    userStates.set(userId, {
      step: "registerUser_name",
      data: {},
    });
    await ctx.reply("Пожалуйста, введите ваше имя:");
  });

  bot.action("register_consent_no", async (ctx) => {
    await ctx.answerCbQuery();
    userStates.delete(ctx.from.id);
    await ctx.reply("Регистрация отменена.");
  });

  bot.action("change_profile", async (ctx) => {
    editProfileHandler.start(ctx);
  });

  // Обработчик для кнопки "Изменить имя"
  bot.action("change_profile_name", async (ctx) => {
    console.log("Изменение имени...");
    await editProfileHandler.setChangeState(ctx, userStates, "name");
  });

  bot.action("change_profile_surname", async (ctx) => {
    console.log("Изменение фамилии...");
    await editProfileHandler.setChangeState(ctx, userStates, "surname");
  });

  // Обработчик для кнопки "Изменить email"
  bot.action("change_profile_email", async (ctx) => {
    await editProfileHandler.setChangeState(ctx, userStates, "email");
  });

  bot.action("change_profile_phone", async (ctx) => {
    await editProfileHandler.setChangeState(ctx, userStates, "phone");
  });

  // Обработчик для кнопки "Изменить пароль"
  bot.action("change_profile_password", async (ctx) => {
    await editProfileHandler.setChangeState(ctx, userStates, "password");
  });

  // Обработчик для кнопки "Изменить пол"
  bot.action("change_profile_sex", async (ctx) => {
    await editProfileHandler.setChangeState(ctx, userStates, "sex");
  });

  // Обработчик для кнопки "Изменить день рождения"
  bot.action("change_profile_birthday", async (ctx) => {
    await editProfileHandler.setChangeState(ctx, userStates, "birthday");
  });

  bot.action("profile_roles", async (ctx) => {
    roleHendlers.myRoles(ctx, userStates);
  });

  bot.action("profile_role_add", async (ctx) => {
    roleHendlers.addRole(ctx, userStates);
  });

  // удаление роли ервый шаг
  bot.action("profile_role_remove", async (ctx) => {
    roleHendlers.removeRoleScene(ctx, userStates);
  });
  bot.action("back_to_profile", async (ctx) => {
    roleHendlers.backToProfile(ctx, userStates);
  });

  // закрыть профайл
  bot.action("close_profile", async (ctx) => {
    roleHendlers.closeProfile(ctx, userStates);
  });

  bot.action(/^play_(.+)$/, (ctx) => {
    const playTitle = ctx.match[1];
    return roleHendlers.handlePlaySelection(ctx, userStates, playTitle);
  });

  // Обработка выбора персонажа
  bot.action(/^character_(.+)$/, (ctx) => {
    const character = ctx.match[1];

    return roleHendlers.handleCharacterSelection(ctx, userStates, character);
  });

  // удалени ролей
  bot.action(/^removecharacter_(.+)$/, (ctx) => {
    const character = ctx.match[1];
    console.log(character);

    return roleHendlers.removeRole(ctx, userStates, character);
  });

  // Обработка возврата к выбору спектаклей
  bot.action("back_to_plays", (ctx) => {
    return roleHendlers.backToPlays(ctx, userStates);
  });

  // Обработка возврата к выбору персонажей
  bot.action(/^back_to_characters_(.+)$/, (ctx) => {
    const playTitle = ctx.match[1];
    return roleHendlers.backToCharacters(ctx, userStates, playTitle);
  });

  // Обработка отмены добавления роли
  bot.action("cancel_add_role", (ctx) => {
    return roleHendlers.cancelAddRole(ctx, userStates);
  });
};
