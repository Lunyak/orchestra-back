const messageEvents = (service) => {
  return async (ctx, next) => {
    // Личная переписка (регистрация, профиль) — только в личке, не обрабатывать в группе
    if (ctx.chat?.type !== "private") {
      return next();
    }
    const userId = ctx.from.id;
    const state = service.userStates.get(userId);

    // Обработка теста при редактировании пользователя
    if (state?.step?.startsWith("change_profile")) {
      service.changeFieldProfile(ctx, state);
      return;
    }

    // Пошаговая регистрация пользователя (шаг «согласие» — только кнопка)
    if (
      state?.step?.startsWith("registerUser_") &&
      state.step !== "registerUser_consent"
    ) {
      const field = state.step.split("_")[1]; // Получаем имя поля из step
      service.saveUserData(ctx, state, field);
      return;
    }
    if (state?.step === "registerUser_consent") {
      ctx.reply("Нажмите кнопку «Даю согласие» для продолжения или «Отмена».");
      return;
    }

    // Передаем управление следующему middleware
    next();
  };
};

module.exports = messageEvents;
