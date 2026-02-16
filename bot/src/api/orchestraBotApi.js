const axios = require("axios");
const API_BASE_URL = require("../const/API_BASE_URL");

const BOT_SECRET = process.env.BOT_SECRET;

function assertConfigured() {
  if (!BOT_SECRET) {
    throw new Error(
      "BOT_SECRET is not configured (required to call backend /bot/* endpoints)",
    );
  }
}

function client() {
  assertConfigured();
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      "X-Bot-Secret": BOT_SECRET,
    },
    timeout: 15_000,
  });
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

module.exports = {
  getRehearsal,
  markRehearsalPublished,
  setRehearsalAttendance,
};

