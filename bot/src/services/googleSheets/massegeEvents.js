function isGoogleSheetsStep(step) {
  if (!step) return false;
  const s = step.toLowerCase();
  return (
    step === "select_play" ||
    s.startsWith("addguest_") ||
    s.startsWith("newpage_") ||
    s.startsWith("getlist_")
  );
}

const messageEvents = (bot) => {
  return async (ctx, next) => {
    if (ctx.message?.text === undefined) return next();
    // Гости и таблицы — только в личке, не обрабатывать в группе
    if (ctx.chat?.type !== "private") return next();

    const userId = ctx.from.id;
    const state = bot.userStates.get(userId);

    if (!state || !isGoogleSheetsStep(state.step)) {
      return next();
    }

    // Шаг выбора спектакля
    if (state.step === "select_play") {
      const play = ctx.message.text;

      // Проверяем, что выбранный спектакль существует
      const plays = ["Васса Железнова", "Куличевское заклятие"];
      if (!plays.includes(play)) {
        await ctx.reply("Пожалуйста, выберите спектакль из списка.");
        return;
      }

      // Сохраняем выбранный спектакль в состоянии
      state.play = play;
      state.step = "addGuest_name";
      bot.userStates.set(userId, state);

      await ctx.reply("Введите имя гостя:");
      return;
    }

    // Остальная логика добавления гостя (addGuest_name и addguest_* из callbacks)
    if (state.step === "addguest_name" || state.step === "addGuest_name") {
      state.data.name = ctx.message.text;
      state.step = "addguest_pass";
      bot.userStates.set(userId, state);
      await ctx.reply("Введите проходка или билет:");
      return;
    }
    if (state.step === "addguest_pass") {
      state.data.pass = ctx.message.text;
      state.step = "addguest_from";
      bot.userStates.set(userId, state);
      await ctx.reply("Укажите, от кого гость:");
      return;
    }
    if (state.step === "addguest_from") {
      state.data.from = ctx.message.text;
      state.step = "addguest_note";
      bot.userStates.set(userId, state);
      await ctx.reply("Добавьте примечание или оставьте пустым:");
      return;
    }
    if (state.step === "addguest_note") {
      state.data.note = ctx.message.text;
      bot.addGuestHendler(ctx, state, userId);
      return;
    }

    // Создание новой страницы для гостей
    if (state.step === "newpage_enter_name") {
      state.data.newSheetName = ctx.message.text;
      bot.createNewPageHandler(ctx, state, userId);
      return;
    }

    return next();
  };
};

module.exports = messageEvents;
