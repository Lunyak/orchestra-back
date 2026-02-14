const { Markup } = require("telegraf");
const {
  getUserData,
  updateUserData,
  createUserData,
} = require("../../api/userApi");
const actions = require("./actions");
const mainHendlers = require("./handlers/mainHandlers");
const roleHendlers = require("./handlers/roleHandler");
const messageEvents = require("./massegeEvents");

class ProfileService {
  constructor(bot, userStates) {
    this.bot = bot;
    this.userStates = userStates;
  }

  /** Личная переписка — только в личке, иначе не дублировать в группу */
  isPrivateChat(ctx) {
    return ctx.chat?.type === "private";
  }

  /**
   * Регистрация пользователя
   * @param {Object} ctx - Контекст Telegraf
   */
  async registerUser(ctx) {
    if (!this.isPrivateChat(ctx)) {
      return ctx.reply(
        "Регистрация только в личных сообщениях. Откройте бота и нажмите «Написать».",
      );
    }
    const userId = ctx.from.id;
    try {
      const user = await this.getUser(userId);
      if (user) {
        return ctx.reply("Вы уже зарегистрированы!");
      }

      // Шаг согласия на обработку персональных данных
      this.userStates.set(userId, {
        step: "registerUser_consent",
        data: {},
      });
      const consentText =
        "Для продолжения регистрации необходимо дать согласие на обработку и хранение персональных данных в соответствии с законодательством Российской Федерации (152-ФЗ «О персональных данных»).\n\nНажимая кнопку ниже, вы подтверждаете своё согласие.";
      await ctx.reply(consentText, {
        reply_markup: {
          inline_keyboard: [
            [
              Markup.button.callback(
                "Даю согласие на обработку персональных данных",
                "register_consent_yes",
              ),
            ],
            [Markup.button.callback("Отмена", "register_consent_no")],
          ],
        },
      });
    } catch (error) {
      await this.handleError(ctx, error, "регистрации пользователя");
    }
  }

  initMainProfileHendler(ctx, userStates) {
    mainHendlers(ctx, userStates);
  }

  initRoleProfileHendler(ctx, userStates) {
    roleHendlers(ctx, userStates);
  }

  /**
   * Обработка ошибки: сообщение пользователю и лог
   * @param {Object} ctx - Контекст Telegraf
   * @param {Error} error - Ошибка
   * @param {string} action - Описание действия (например, "регистрации пользователя")
   */
  async handleError(ctx, error, action) {
    console.error(`Ошибка при ${action}:`, error);
    await ctx
      .reply(`Произошла ошибка при ${action}. Попробуйте позже.`)
      .catch(() => {});
  }

  /**
   * Получение данных пользователя
   * @param {number} userId - ID пользователя
   * @returns {Object} - Данные пользователя
   */
  async getUser(userId) {
    return await getUserData(userId).catch((error) => {
      console.error("Ошибка при получении данных пользователя:", error);
      throw error;
    });
  }

  /**
   * Обновление данных пользователя
   * @param {number} userId - ID пользователя
   * @param {Object} data - Новые данные
   */
  async updateUser(userId, data) {
    return await updateUserData(userId, data).catch((error) => {
      console.error("Ошибка при обновлении данных пользователя:", error);
      throw error;
    });
  }

  async changeFieldProfile(ctx, state) {
    const field = state.step.replace("change_profile_", ""); // Извлекаем поле (name, email, password и т.д.)
    const newValue = ctx.message.text; // Новое значение, введённое пользователем
    const userId = ctx.from.id;

    try {
      // Обновляем данные пользователя
      await updateUserData(userId, { [field]: newValue });

      // Очищаем состояние
      this.userStates.delete(userId);

      // Отправляем подтверждение
      await ctx.reply(`Поле "${field}" успешно изменено на: ${newValue}`);
    } catch (error) {
      await ctx.reply(
        `Произошла ошибка при изменении поля "${field}". Пожалуйста, попробуйте позже.`,
      );
      console.error(`Ошибка при изменении поля "${field}":`, error);
    }
  }

  async saveUserData(ctx, state, field) {
    const value = ctx.message.text;
    const userId = ctx.from.id;

    // Сохраняем данные в state
    state.data[field] = value;
    this.userStates.set(userId, state);

    // Определяем следующий шаг
    const nextStep = this.getNextRegistrationStep(state.step);

    if (nextStep) {
      // Переходим на следующий шаг
      state.step = nextStep;
      this.userStates.set(userId, state);
      ctx.reply(this.getStepMessage(nextStep));
    } else {
      // Если шагов больше нет, завершаем регистрацию
      await this.createUser(ctx, state.data);
      this.userStates.delete(userId);
    }
  }

  getNextRegistrationStep(currentStep) {
    const steps = [
      "registerUser_name",
      "registerUser_surname",
      "registerUser_email",
      "registerUser_phone",
      "registerUser_sex",
      "registerUser_birthday",
    ];
    const currentIndex = steps.indexOf(currentStep);
    return steps[currentIndex + 1];
  }

  getStepMessage(step) {
    const messages = {
      registerUser_name: "Введите ваше имя:",
      registerUser_surname: "Введите вашу фамилию:",
      registerUser_email: "Введите ваш email:",
      registerUser_phone: "Введите ваш телефон:",
      registerUser_sex: "Ваш пол",
      registerUser_birthday: "Введите вашу дату рождения (ДД.ММ.ГГГГ):",
    };
    return messages[step];
  }

  async createUser(ctx, userData) {
    const userId = ctx.from.id;
    try {
      await createUserData({
        ...userData,
        role: "user",
        telegram_id: String(userId),
      });
      ctx.reply("Регистрация успешно завершена!");
    } catch (error) {
      console.error("Ошибка при создании пользователя:", error);
      ctx.reply("Произошла ошибка при регистрации. Попробуйте снова.");
    }
  }

  initMessageHendlers() {
    const profileMiddleware = messageEvents(this);
    this.bot.use(profileMiddleware);
  }

  init() {
    actions(this.bot, this.userStates);
    this.initMessageHendlers();
  }
}

module.exports = ProfileService;
