const actionHandlers = (service) => {
  // Обработчик для кнопок навигации
  service.bot.action(/page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]); // Получаем номер страницы
    currentPage = page;
    await service.sendPage(ctx, currentPage);
  });

  // Handle get list — выбор листа по индексу
  service.bot.action(/^getlist_(\d+)$/, async (ctx) => {
    const userId = ctx.from.id;
    const index = parseInt(ctx.match[1], 10);
    const state = service.userStates.get(userId);
    if (
      !state ||
      !state.sheetNames ||
      index < 0 ||
      index >= state.sheetNames.length
    ) {
      await ctx.reply("Выберите список заново: /guests");
      return;
    }
    const sheetName = state.sheetNames[index];
    await service.getList(ctx, sheetName);
  });

  // Handle add guest — выбор листа по индексу
  service.bot.action(/^addguest_(\d+)$/, async (ctx) => {
    const userId = ctx.from.id;
    const index = parseInt(ctx.match[1], 10);
    const state = service.userStates.get(userId);
    if (
      !state ||
      !state.sheetNames ||
      index < 0 ||
      index >= state.sheetNames.length
    ) {
      await ctx.reply("Выберите список заново: /addguest");
      return;
    }
    state.sheetName = state.sheetNames[index];
    state.step = "addguest_name";
    service.userStates.set(userId, state);
    ctx.reply("Введите имя гостя:");
  });

  // Handle new page play selection
  service.bot.action(/^newpage_(.+)$/, async (ctx) => {
    const userId = ctx.from.id;
    const play = ctx.match[1];

    const state = service.userStates.get(userId);
    if (!state || state.step !== "newpage_select_play") return;

    state.play = play;
    state.step = "newpage_enter_name";
    service.userStates.set(userId, state);

    ctx.reply("Введите название для новой страницы гостей:");
  });
};

module.exports = actionHandlers;
