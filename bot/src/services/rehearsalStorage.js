const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const FILE_PATH = path.join(DATA_DIR, "rehearsal.json");

const DEFAULT_DATA = {
  // «ближайшая» или последняя созданная репетиция (для обратной совместимости)
  nextRehearsal: null,
  // карта явок: { [dateKey]: { [userId]: { status, userName, meta } } }
  attendance: {},
  // старое поле с одним сообщением опроса (для обратной совместимости)
  attendanceMessageInfo: null,
  // новые поля для поддержки нескольких репетиций и опросов сразу
  // все репетиции по ключу даты: "YYYY-MM-DD" => { dateKey, dateDisplay, time, place }
  rehearsalsByDate: {},
  // информация о сообщении опроса по каждой дате: dateKey => { chatId, messageId, dateKey }
  attendanceMessagesByDate: {},
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function read() {
  ensureDir();
  if (!fs.existsSync(FILE_PATH)) {
    return { ...DEFAULT_DATA };
  }
  try {
    const raw = fs.readFileSync(FILE_PATH, "utf8");
    return { ...DEFAULT_DATA, ...JSON.parse(raw) };
  } catch (e) {
    console.error("rehearsalStorage read error:", e);
    return { ...DEFAULT_DATA };
  }
}

function write(data) {
  ensureDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), "utf8");
}

function getNextRehearsal() {
  const data = read();

  // Если есть несколько репетиций, выбираем ближайшую по дате (сегодня или позже)
  const map = data.rehearsalsByDate || {};
  const keys = Object.keys(map);

  if (keys.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let best = null;
    let bestDate = null;

    for (const key of keys) {
      const r = map[key];
      if (!r || !r.dateKey) continue;
      const d = new Date(r.dateKey);
      if (Number.isNaN(d.getTime())) continue;

      // Интересуют только сегодняшние и будущие даты
      if (d < today) continue;

      if (!bestDate || d < bestDate) {
        best = r;
        bestDate = d;
      }
    }

    if (best) return best;
  }

  // Fallback на старое поле, если новых данных нет
  return data.nextRehearsal;
}

function setNextRehearsal(rehearsal) {
  const data = read();
  data.nextRehearsal = rehearsal;
  if (!data.rehearsalsByDate) data.rehearsalsByDate = {};
  if (rehearsal && rehearsal.dateKey) {
    data.rehearsalsByDate[rehearsal.dateKey] = rehearsal;
  }
  write(data);
}

function getRehearsal(dateKey) {
  const data = read();
  const map = data.rehearsalsByDate || {};
  return map[dateKey] || null;
}

function getAllRehearsals() {
  const data = read();
  return data.rehearsalsByDate || {};
}

function getAttendance(dateKey) {
  const data = read();
  return data.attendance[dateKey] || {};
}

function getAttendanceMessageInfo(dateKey) {
  const data = read();

  // Если передали дату — пробуем взять точное сообщение для этой даты
  if (dateKey) {
    const map = data.attendanceMessagesByDate || {};
    if (map[dateKey]) return map[dateKey];
    return null;
  }

  // Иначе — старое поведение: одно последнее сообщение
  return data.attendanceMessageInfo || null;
}

function setAttendanceMessageInfo(chatId, messageId, dateKey) {
  const data = read();
  // сохраняем последнее сообщение (для обратной совместимости)
  data.attendanceMessageInfo = { chatId, messageId, dateKey };

  // и кладём его в карту по дате, чтобы поддерживать несколько активных опросов
  if (!data.attendanceMessagesByDate) data.attendanceMessagesByDate = {};
  data.attendanceMessagesByDate[dateKey] = { chatId, messageId, dateKey };
  write(data);
}

function setAttendance(dateKey, userId, userName, status, meta = {}) {
  const data = read();
  if (!data.attendance[dateKey]) data.attendance[dateKey] = {};
  data.attendance[dateKey][String(userId)] = { status, userName, meta };
  write(data);
}

// 0 = воскресенье, 1 = понедельник, ..., 6 = суббота (как в JS getDay())
const WEEKDAY_NAMES = {
  воскресенье: 0,
  понедельник: 1,
  вторник: 2,
  среда: 3,
  четверг: 4,
  пятница: 5,
  суббота: 6,
};

/**
 * Парсит дату из строки: ДД.ММ, ДД.ММ.ГГГГ, "завтра", или день недели (понедельник, вторник, пятница и т.д.).
 * Возвращает { dateKey: "YYYY-MM-DD", display: "DD.MM.YYYY" } или null.
 */
function parseDate(input) {
  const trimmed = (input || "").trim().toLowerCase();
  const now = new Date();
  const y = now.getFullYear();

  if (trimmed === "завтра") {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    const d = t.getDate();
    const m = t.getMonth() + 1;
    const dateKey = `${t.getFullYear()}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const display = `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${t.getFullYear()}`;
    return { dateKey, display };
  }

  const weekday = WEEKDAY_NAMES[trimmed];
  if (weekday !== undefined) {
    const today = now.getDay();
    let daysAhead = (weekday - today + 7) % 7;
    if (daysAhead === 0) daysAhead = 7;
    const t = new Date(now);
    t.setDate(t.getDate() + daysAhead);
    const d = t.getDate();
    const m = t.getMonth() + 1;
    const dateKey = `${t.getFullYear()}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const display = `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${t.getFullYear()}`;
    return { dateKey, display };
  }

  const parts = trimmed.split(/[.\s/]/).filter(Boolean);
  if (parts.length === 2) {
    const [d, m] = parts.map((p) => parseInt(p, 10));
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      const dateKey = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const display = `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
      return { dateKey, display };
    }
  }
  if (parts.length === 3) {
    const [d, m, yr] = parts.map((p) => parseInt(p, 10));
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && yr >= 2020 && yr <= 2030) {
      const dateKey = `${yr}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const display = `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${yr}`;
      return { dateKey, display };
    }
  }
  return null;
}

module.exports = {
  getNextRehearsal,
  setNextRehearsal,
  getRehearsal,
  getAllRehearsals,
  getAttendance,
  setAttendance,
  getAttendanceMessageInfo,
  setAttendanceMessageInfo,
  parseDate,
};
