const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const FILE_PATH = path.join(DATA_DIR, "quiz-state.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function read() {
  ensureDir();
  if (!fs.existsSync(FILE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
  } catch (e) {
    console.error("quizStateStorage read error:", e);
    return null;
  }
}

function write(data) {
  ensureDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), "utf8");
}

/** Сохранить сообщение «вопрос дня» для привязки ответов */
function setTodayQuestionMessage(chatId, messageId, questionId, dateKey) {
  write({ chatId, messageId, questionId, dateKey });
}

/** Получить данные сообщения «вопрос дня» (если ответ пришёл в reply на него) */
function getTodayQuestionMessage() {
  return read();
}

module.exports = {
  setTodayQuestionMessage,
  getTodayQuestionMessage,
};
