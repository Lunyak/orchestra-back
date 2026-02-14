const { Markup } = require("telegraf");

module.exports.Buttons = {
  button_cancel: (action = "cancel_action") => {
    return Markup.inlineKeyboard([
      [Markup.button.callback("❌ Отмена", action)],
    ]);
  },
};
