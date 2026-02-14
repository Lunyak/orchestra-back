const { getUserData, updateUserData } = require("../../../api/userApi");
const ButtonsProfile = require("../buttons/buttons");
const handleActionError = require("./actionErrorHandler");
const { Markup } = require("telegraf");

module.exports = {
  /**
   * Редактирование профиля пользователя
   * @param {Object} ctx - Контекст Telegraf
   */
  async start(ctx) {
    const userId = ctx.from.id;
    try {
      const user = await getUserData(userId).catch((error) => {
        console.error("Ошибка при получении данных пользователя:", error);
        throw error;
      });
      if (!user) {
        return ctx.reply(
          "Сначала зарегистрируйтесь с помощью команды /register",
        );
      }
      await ctx.reply("Что вы хотите изменить?", {
        ...ButtonsProfile.ButtonsChangeProfileFields,
      });
    } catch (error) {
      handleActionError(ctx, error, "редактировании профиля");
    }
  },

  /**
   * Установка состояния для изменения поля
   * @param {Object} ctx - Контекст Telegraf
   * @param {Map} userStates - Карта состояний пользователей
   * @param {string} field - Поле для изменения (name, email, password и т.д.)
   */
  async setChangeState(ctx, userStates, field) {
    const userId = ctx.from.id;

    // Устанавливаем состояние для изменения поля
    userStates.set(userId, {
      step: `change_profile_${field}`,
      data: {},
    });

    const fieldLabels = {
      name: "имени",
      surname: "фамилии",
      email: "email",
      phone: "номера телефона",
      sex: "пола",
      birthday: "дня рождения",
      password: "пароля",
    };
    const label = fieldLabels[field] || field;
    await ctx.reply(`Введите новое значение для ${label}:`);
  },

  /**
   * Показывает меню выбора роли в театре
   * @param {Object} ctx - Контекст Telegraf
   * @param {Map} userStates - Карта состояний пользователей
   */
  async setTheaterRoleSelection(ctx, userStates) {
    const userId = ctx.from.id;

    try {
      await ctx.answerCbQuery();
      
      const theaterRoles = [
        "Актер",
        "Режиссер",
        "Продюсер",
        "Художник",
        "Костюмер",
        "Гример",
        "Администратор",
        "Другое",
      ];

      const buttons = theaterRoles.map((role) => [
        Markup.button.callback(role, `theater_role_${role}`),
      ]);
      buttons.push([Markup.button.callback("« Назад", "back_to_profile")]);

      await ctx.editMessageText(
        "Выберите вашу роль в театре:",
        Markup.inlineKeyboard(buttons)
      );

      userStates.set(userId, {
        step: "select_theater_role",
        data: {},
      });
    } catch (error) {
      handleActionError(ctx, error, "выборе роли в театре");
    }
  },

  /**
   * Сохраняет выбранную роль в театре
   * @param {Object} ctx - Контекст Telegraf
   * @param {Map} userStates - Карта состояний пользователей
   * @param {string} role - Выбранная роль
   */
  async saveTheaterRole(ctx, userStates, role) {
    const userId = ctx.from.id;

    try {
      await ctx.answerCbQuery();

      // Обновляем роль в базе данных
      await updateUserData(userId, { role });

      // Очищаем состояние
      userStates.delete(userId);

      // Получаем обновленные данные пользователя
      const user = await getUserData(userId);
      
      if (!user) {
        return ctx.editMessageText("Не удалось загрузить профиль.");
      }

      const { formatProfileMessage } = require("../../../utils/formatters");
      const profileMessage = formatProfileMessage(user);

      await ctx.editMessageText(profileMessage, {
        parse_mode: "HTML",
        ...ButtonsProfile.ButtonsInitProfile,
      });
    } catch (error) {
      handleActionError(ctx, error, "сохранении роли в театре");
    }
  },
};
