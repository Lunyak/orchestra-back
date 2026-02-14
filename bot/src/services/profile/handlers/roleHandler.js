const { Markup } = require("telegraf");
const { getUserData, updateUserData } = require("../../../api/userApi");
const { formatProfileMessage } = require("../../../utils/formatters");
const API_BASE_URL = require("../../../const/API_BASE_URL");
const { default: axios } = require("axios");
const PLAYS = require("../../../const/PLAYS");
const { Buttons } = require("../../../shared/buttons");
const ButtonsProfile = require("../buttons/buttons");
const { logBox } = require("../../../utils/logger");
const useUserDate = require("../helpers/useUserDate");

/**
 * Обработчики callback-запросов для профиля
 */
const roleHendlers = {
  /**
   * Обработчик просмотра ролей
   */
  async myRoles(ctx, userStates) {
    const userId = ctx.from.id;

    try {
      const user = await getUserData(userId);

      if (!user) {
        return ctx.answerCbQuery("Профиль не найден.");
      }

      const characters = user.characters || [];

      const rolesMessage =
        characters.length === 0
          ? "У вас пока нет ролей"
          : `<b>Ваши роли:</b>\n\n${characters
              .map((role, index) => `${index + 1}. ${role}`)
              .join("\n")}`;

      await ctx.editMessageText(rolesMessage, {
        parse_mode: "HTML",
        ...ButtonsProfile.ButtonsAddRole,
      });

      await ctx.answerCbQuery();
    } catch (error) {
      console.error("Error handling my_roles action:", error);
      await ctx.answerCbQuery("Произошла ошибка при загрузке ролей.");
    }
  },

  /**
   * Обработчик возврата к профилю
   */
  async backToProfile(ctx, userStates) {
    const userId = ctx.from.id;

    try {
      const user = await getUserData(userId);

      if (!user) {
        return ctx.answerCbQuery("Профиль не найден.");
      }

      const profileMessage = formatProfileMessage(user);

      await ctx.editMessageText(profileMessage, {
        parse_mode: "HTML",
        ...ButtonsProfile.ButtonsInitProfile,
      });

      await ctx.answerCbQuery();
    } catch (error) {
      console.error("Error handling back_to_profile action:", error);
      await ctx.answerCbQuery("Произошла ошибка.");
    }
  },

  /**
   * Обработчик добавления роли
   */
  async addRole(ctx, userStates) {
    await ctx.answerCbQuery("Переход к добавлению роли...");
    await ctx.deleteMessage();

    // Импортируем обработчик добавления роли
    const userId = ctx.from.id;

    const currentState = userStates.get(userId) || {};

    userStates.set(userId, {
      ...currentState,
      step: "profile_role_add",
    });

    // Create inline keyboard with plays
    const buttons = Object.keys(PLAYS).map((title) => [
      Markup.button.callback(title, `play_${title}`),
    ]);

    // Add cancel button
    buttons.push([Markup.button.callback("❌ Отмена", "cancel_add_role")]);

    await ctx.reply("Выбери спектакль:", Markup.inlineKeyboard(buttons));
  },

  /**
   * Обработчик удаления роли
   */
  async removeRoleScene(ctx, userStates) {
    await ctx.answerCbQuery("Переход к удалению роли...");
    await ctx.deleteMessage();

    const userId = ctx.from.id;

    const user = await getUserData(userId);
    if (!user) {
      return ctx.reply("Профиль не найден.");
    }

    const characters = user.characters || [];
    if (characters.length === 0) {
      return ctx.reply("У вас пока нет ролей для удаления.", {
        ...ButtonsProfile.ButtonsAddRole,
      });
    }

    useUserDate.changeStep(userId, userStates, "removeCharacter_select", {
      user: { ...user },
    });

    const buttons = characters.map((title) => [
      Markup.button.callback(title, `removecharacter_${title}`),
    ]);

    await ctx.reply("Какую роль убрать?", Markup.inlineKeyboard(buttons));
  },

  async removeRole(ctx, userStates, name) {
    await ctx.answerCbQuery();

    const userId = ctx.from.id;

    const user = await getUserData(userId);
    if (!user) {
      return ctx.reply("Профиль не найден.");
    }

    const roleList = user.characters || [];
    const newRoleList = roleList.filter((a) => a !== name);

    try {
      await updateUserData(userId, {
        characters: newRoleList,
      });

      await ctx.reply(
        `✅ Роль "${name}" успешно удалена!`,
        Markup.inlineKeyboard([
          [Markup.button.callback("« Вернуться к профилю", "back_to_profile")],
        ]),
      );
    } catch (error) {
      console.log(error);
      await ctx.reply(
        "❌ Произошла ошибка при удалении роли. Пожалуйста, попробуйте еще раз.",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Вернуться к профилю", "back_to_profile")],
        ]),
      );
    }
  },

  /**
   * Обработчик закрытия профиля
   */
  async closeProfile(ctx, userStates) {
    const userId = ctx.from.id;

    try {
      // Удаляем сообщение с профилем
      await ctx.deleteMessage();

      // Отвечаем на callback
      await ctx.answerCbQuery("Профиль закрыт");

      // Очищаем состояние, если оно связано с профилем
      const state = userStates.get(userId);
      if (state && state.step && state.step.includes("profile")) {
        userStates.delete(userId);
      }
    } catch (error) {
      console.error("Error closing profile:", error);
      await ctx.answerCbQuery("Не удалось закрыть профиль");
    }
  },

  async handlePlaySelection(ctx, userStates, playTitle) {
    const userId = ctx.from.id;

    try {
      await ctx.answerCbQuery(`Выбран спектакль: ${playTitle}`);

      useUserDate.changeStep(userId, userStates, "profile_character_select", {
        selectedPlay: playTitle,
      });

      // Получаем список персонажей для выбранного спектакля
      const characters = PLAYS[playTitle] || [];

      if (characters.length === 0) {
        await ctx.editMessageText(
          `В спектакле "${playTitle}" нет доступных персонажей.`,
          ButtonsProfile.ButtonsBackPlays,
        );
        return;
      }

      // Создаем клавиатуру с персонажами
      const characterButtons = characters.map((character) => [
        Markup.button.callback(character, `character_${character}`),
      ]);

      // Добавляем кнопки навигации
      characterButtons.push([
        Markup.button.callback("« Назад к спектаклям", "back_to_plays"),
      ]);
      characterButtons.push([
        Markup.button.callback("❌ Отмена", "cancel_add_role"),
      ]);

      await ctx.editMessageText(
        `Выбери персонажа из спектакля "${playTitle}":`,
        Markup.inlineKeyboard(characterButtons),
      );
    } catch (error) {
      console.error("Error handling play selection:", error);
      await ctx.answerCbQuery("Произошла ошибка при выборе спектакля");
      await ctx.editMessageText(
        "Произошла ошибка при выборе спектакля. Пожалуйста, попробуйте снова.",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Назад", "back_to_profile")],
        ]),
      );
    }
  },

  /**
   * Обработчик выбора персонажа
   * @param {Object} ctx - Контекст Telegraf
   * @param {Map} userStates - Состояния пользователей
   * @param {String} character - Название спектакля
   * @param {String} character - Имя персонажа
   */
  async handleCharacterSelection(ctx, userStates, character) {
    const userId = ctx.from.id;

    try {
      await ctx.answerCbQuery(`Выбран персонаж: ${character}`);

      // Получаем данные пользователя
      const user = await getUserData(userId);

      if (!user) {
        return ctx.editMessageText(
          "Не удалось найти ваш профиль. Сначала зарегистрируйтесь.",
          Markup.inlineKeyboard([
            [Markup.button.callback("Регистрация", "register")],
          ]),
        );
      }

      try {
        // Проверяем, не добавлена ли уже такая роль
        const existingCharacters = user.characters || [];
        if (existingCharacters.includes(character)) {
          const selectedPlay = userStates.get(userId)?.selectedPlay;
          const backToCharactersData = selectedPlay
            ? `back_to_characters_${selectedPlay}`
            : "back_to_plays";
          return ctx.editMessageText(
            `У вас уже есть роль "${character}"`,
            Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "« Назад к персонажам",
                  backToCharactersData,
                ),
              ],
              [Markup.button.callback("« Назад к профилю", "back_to_profile")],
            ]),
          );
        }

        // Используем актуальный список ролей с сервера, а не из state (state может быть устаревшим)
        const currentCharacters = user.characters || [];

        await updateUserData(userId, {
          characters: [...currentCharacters, character],
        });

        await ctx.editMessageText(
          `Роль "${character}" успешно добавлена!`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "« Вернуться к профилю",
                "back_to_profile",
              ),
            ],
          ]),
        );
      } catch (apiError) {
        console.error("API Error adding character:", apiError);
        await ctx.editMessageText(
          `Ошибка при добавлении роли: ${
            apiError.message || "Неизвестная ошибка"
          }`,
          Markup.inlineKeyboard([
            [Markup.button.callback("« Назад", "back_to_profile")],
          ]),
        );
      }
    } catch (error) {
      console.error("Error handling character selection:", error);
      await ctx.answerCbQuery("Произошла ошибка при выборе персонажа");
      await ctx.editMessageText(
        "Произошла ошибка при выборе персонажа. Пожалуйста, попробуйте снова.",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Назад", "back_to_profile")],
        ]),
      );
    }
  },

  /**
   * Обработчик возврата к выбору спектаклей
   */
  async backToPlays(ctx, userStates) {
    const userId = ctx.from.id;

    try {
      await ctx.answerCbQuery("Возврат к выбору спектакля");

      const currentState = userStates.get(userId) || {};

      userStates.set(userId, {
        ...currentState,
        step: "profile_role_add",
        selectedPlay: null,
      });

      // Create inline keyboard with plays
      const buttons = Object.keys(PLAYS).map((title) => [
        Markup.button.callback(title, `play_${title}`),
      ]);

      // Add cancel button
      buttons.push([Markup.button.callback("❌ Отмена", "cancel_add_role")]);

      await ctx.editMessageText(
        "Выбери спектакль:",
        Markup.inlineKeyboard(buttons),
      );
    } catch (error) {
      console.error("Error handling back to plays:", error);
      await ctx.answerCbQuery("Произошла ошибка");
      await ctx.editMessageText(
        "Произошла ошибка. Пожалуйста, попробуйте снова.",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Назад", "back_to_profile")],
        ]),
      );
    }
  },

  /**
   * Обработчик возврата к выбору персонажей
   */
  async backToCharacters(ctx, userStates, playTitle) {
    const userId = ctx.from.id;

    try {
      await ctx.answerCbQuery(`Возврат к персонажам спектакля "${playTitle}"`);

      const currentState = userStates.get(userId) || {};

      userStates.set(userId, {
        ...currentState,
        step: "profile_character_select",
        selectedPlay: playTitle,
      });

      // Получаем список персонажей для выбранного спектакля
      const characters = PLAYS[playTitle] || [];

      // Создаем клавиатуру с персонажами (callback только с именем персонажа — как в handlePlaySelection)
      const characterButtons = characters.map((charName) => [
        Markup.button.callback(charName, `character_${charName}`),
      ]);

      // Добавляем кнопки навигации
      characterButtons.push([
        Markup.button.callback("« Назад к спектаклям", "back_to_plays"),
      ]);
      characterButtons.push([
        Markup.button.callback("❌ Отмена", "cancel_add_role"),
      ]);

      await ctx.editMessageText(
        `Выбери персонажа из спектакля "${playTitle}":`,
        Markup.inlineKeyboard(characterButtons),
      );
    } catch (error) {
      console.error("Error handling back to characters:", error);
      await ctx.answerCbQuery("Произошла ошибка");
      await ctx.editMessageText(
        "Произошла ошибка. Пожалуйста, попробуйте снова.",
        Markup.inlineKeyboard([
          [Markup.button.callback("« Назад", "back_to_profile")],
        ]),
      );
    }
  },

  /**
   * Обработчик отмены добавления роли
   */
  async cancelAddRole(ctx, userStates) {
    const userId = ctx.from.id;

    try {
      await ctx.answerCbQuery("Добавление роли отменено");

      const currentState = userStates.get(userId) || {};

      // Возвращаемся к профилю
      userStates.set(userId, {
        ...currentState,
        step: "profile_view",
        selectedPlay: null,
      });

      // Возвращаемся к профилю
      await this.myRoles(ctx, userStates);
    } catch (error) {
      console.error("Error handling cancel add role:", error);
      await ctx.answerCbQuery("Произошла ошибка");
      await ctx.deleteMessage().catch(() => {});
      await ctx.reply(
        "Произошла ошибка. Пожалуйста, попробуйте снова.",
        Markup.inlineKeyboard([
          [Markup.button.callback("Мой профиль", "show_profile")],
        ]),
      );
    }
  },
};

module.exports = roleHendlers;
