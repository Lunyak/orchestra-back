/**
 * Выводит красивое сообщение в консоль с рамкой
 * @param {string} message - Текст сообщения
 * @param {object} [options] - Дополнительные параметры для boxen
 * @param {string} [options.padding=1] - Внутренний отступ
 * @param {string} [options.margin=1] - Внешний отступ
 * @param {string} [options.borderStyle="round"] - Стиль рамки
 * @param {string} [options.borderColor="green"] - Цвет рамки
 * @param {string} [options.backgroundColor="#555"] - Цвет фона
 */
async function logBox(message, options = {}) {
  // Динамический импорт boxen
  const boxen = (await import("boxen")).default;

  const defaultOptions = {
    padding: 1,
    margin: 1,
    borderStyle: "round",
    borderColor: "green",
    backgroundColor: "#555",
  };

  const finalOptions = { ...defaultOptions, ...options };
  console.log(boxen(message, finalOptions));
}

module.exports = { logBox };
