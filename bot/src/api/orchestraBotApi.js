const axios = require("axios");
const API_BASE_URL = require("../const/API_BASE_URL");

const BOT_SECRET = process.env.BOT_SECRET;
const BOT_INTEGRATION_ID =
  process.env.TELEGRAM_BOT_INTEGRATION_ID || process.env.BOT_INTEGRATION_ID;

function assertConfigured() {
  if (!BOT_SECRET) {
    throw new Error(
      "BOT_SECRET is not configured (required to call backend /bot/* endpoints)",
    );
  }
  if (!BOT_INTEGRATION_ID) {
    throw new Error(
      "TELEGRAM_BOT_INTEGRATION_ID is not configured (required for multi-bot /bot/* endpoints)",
    );
  }
}

function client() {
  assertConfigured();
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      "X-Bot-Secret": BOT_SECRET,
      "X-Telegram-Bot-Integration-Id": BOT_INTEGRATION_ID,
    },
    timeout: 15_000,
  });
}

async function getIntegration() {
  const c = client();
  const { data } = await c.get("/bot/integration");
  return data;
}

async function getRehearsal(rehearsalId) {
  const c = client();
  const { data } = await c.get(
    `/bot/rehearsals/${encodeURIComponent(rehearsalId)}`,
  );
  return data;
}

async function markRehearsalPublished(rehearsalId, payload) {
  const c = client();
  const { data } = await c.post(
    `/bot/rehearsals/${encodeURIComponent(rehearsalId)}/published`,
    payload,
  );
  return data;
}

async function setRehearsalAttendance(rehearsalId, payload) {
  const c = client();
  const { data } = await c.post(
    `/bot/rehearsals/${encodeURIComponent(rehearsalId)}/attendance`,
    payload,
  );
  return data;
}

async function getDirectorSession(projectId, sessionId) {
  const c = client();
  const { data } = await c.get(
    `/bot/director-sessions/${encodeURIComponent(projectId)}/${encodeURIComponent(sessionId)}`,
  );
  return data;
}

async function listUpcomingCalls() {
  const c = client();
  const { data } = await c.get("/bot/upcoming-calls");
  return data;
}

async function listAvailabilityGaps() {
  const c = client();
  const { data } = await c.get("/bot/availability-gaps");
  return data;
}

async function markDirectorSessionPublished(projectId, sessionId, payload) {
  const c = client();
  const { data } = await c.post(
    `/bot/director-sessions/${encodeURIComponent(projectId)}/${encodeURIComponent(sessionId)}/published`,
    payload,
  );
  return data;
}

async function setDirectorSessionAttendance(projectId, sessionId, payload) {
  const c = client();
  const { data } = await c.post(
    `/bot/director-sessions/${encodeURIComponent(projectId)}/${encodeURIComponent(sessionId)}/attendance`,
    payload,
  );
  return data;
}

module.exports = {
  getIntegration,
  getRehearsal,
  markRehearsalPublished,
  setRehearsalAttendance,
  getDirectorSession,
  listUpcomingCalls,
  listAvailabilityGaps,
  markDirectorSessionPublished,
  setDirectorSessionAttendance,
};

