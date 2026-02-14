const { getUserData, updateUserData } = require("../../../api/userApi");
const ButtonsProfile = require("../buttons/buttons");
const handleActionError = require("./actionErrorHandler");

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
};
