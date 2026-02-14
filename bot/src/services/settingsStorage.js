const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const FILE_PATH = path.join(DATA_DIR, "settings.json");

const DEFAULT_DATA = {
  groupChatId: null,
  announcementsThreadId: null,
  attendanceThreadId: null,
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
    console.error("settingsStorage read error:", e);
    return { ...DEFAULT_DATA };
  }
}

function write(data) {
  ensureDir();
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), "utf8");
}

function getGroupChatId() {
  const data = read();
  return data.groupChatId || null;
}

function setGroupChatId(id) {
  const data = read();
  data.groupChatId = id == null ? null : String(id);
  write(data);
}

function getAnnouncementsThreadId() {
  const data = read();
  return data.announcementsThreadId || null;
}

function setAnnouncementsThreadId(id) {
  const data = read();
  data.announcementsThreadId = id == null ? null : String(id);
  write(data);
}

function getAttendanceThreadId() {
  const data = read();
  return data.attendanceThreadId || null;
}

function setAttendanceThreadId(id) {
  const data = read();
  data.attendanceThreadId = id == null ? null : String(id);
  write(data);
}

module.exports = {
  getGroupChatId,
  setGroupChatId,
  getAnnouncementsThreadId,
  setAnnouncementsThreadId,
  getAttendanceThreadId,
  setAttendanceThreadId,
};
