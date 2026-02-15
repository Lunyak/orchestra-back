const COMMANDS = [
  { command: "start", shortDescription: "Начать", adminOnly: false },
  { command: "profile", shortDescription: "👤 Профиль", adminOnly: false },
  { command: "register", shortDescription: "📝 Регистрация", adminOnly: false },
  {
    command: "setrehearsal",
    shortDescription: "📅 Создать репетицию",
    adminOnly: true,
  },
  { command: "who", shortDescription: "👥 Кто будет", adminOnly: false },
  {
    command: "setgroup",
    shortDescription: "⚙️ Настроить группу",
    adminOnly: true,
  },
  { command: "help", shortDescription: "❓ Помощь", adminOnly: false },
  { command: "menu", shortDescription: "📋 Меню", adminOnly: false },
];

module.exports = {
  COMMANDS,
};
