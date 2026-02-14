/**
 * Форматирует данные пользователя в HTML-сообщение о профиле
 * @param {Object} user - Данные пользователя
 * @returns {string} - HTML-форматированное сообщение
 */
const formatProfileMessage = (user) => {
  const characters = user?.characters || [];
  const charactersList =
    characters.length > 0
      ? characters.map((char) => `• ${char}`).join("\n")
      : "Нет ролей";

  return (
    `<b>Ваш профиль в Дофамин</b>\n\n` +
    `<b>Имя:</b> ${user.name || "Не указано"}\n` +
    `<b>Фамилия:</b> ${user.surname || "Не указано"}\n` +
    `<b>Email:</b> ${user.email || "Не указан"}\n` +
    `<b>Телефон:</b> ${user.phone || "Не указан"}\n` +
    `<b>Пол:</b> ${user.sex || "Не указан"}\n` +
    `<b>День рождения:</b> ${user?.birthday || "Не указан"}\n` +
    `<b>Роли:</b>\n${charactersList}\n\n` +
    `Используйте кнопки ниже для управления профилем.`
  );
};

/**
 * Экранирует текст для таблицы (короткие значения, без переносов)
 */
function cell(value) {
  if (value == null || value === undefined) return "—";
  const s = Array.isArray(value) ? value.join(", ") : String(value);
  return s.replace(/\s+/g, " ").slice(0, 30) || "—";
}

/**
 * Форматирует список пользователей в текстовую таблицу (без паролей)
 * @param {Array} users - Массив пользователей из API
 * @returns {string}
 */
function formatUsersTable(users) {
  if (!users || !users.length) return "Нет зарегистрированных пользователей.";
  const headers = [
    "№",
    "Имя",
    "Фамилия",
    "Email",
    "Телефон",
    "Роль",
    "ДР",
    "TG ID",
    "Роли",
  ];
  const rows = users.map((u, i) => [
    i + 1,
    cell(u.name),
    cell(u.surname),
    cell(u.email),
    cell(u.phone),
    cell(u.role),
    cell(u.birthday),
    cell(u.telegram_id),
    cell(u.characters),
  ]);
  const colWidths = headers.map((h, c) =>
    Math.max(h.length, ...rows.map((r) => String(r[c]).length), 2),
  );
  const pad = (s, w) => String(s).padEnd(w).slice(0, w);
  const sep = colWidths.map((w) => "—".repeat(Math.min(w, 12))).join(" ");
  const lines = [
    headers.map((h, c) => pad(h, colWidths[c])).join(" "),
    sep,
    ...rows.map((r) => r.map((v, c) => pad(v, colWidths[c])).join(" ")),
  ];
  return lines.join("\n");
}

module.exports = {
  formatProfileMessage,
  formatUsersTable,
};
