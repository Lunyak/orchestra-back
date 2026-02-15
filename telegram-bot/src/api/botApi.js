const axios = require("axios");
const API_BASE_URL = require("../const/API_BASE_URL");

const BOT_SECRET = process.env.BOT_SECRET;

// Создаем axios инстанс с заголовками для аутентификации бота
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "X-Bot-Secret": BOT_SECRET,
  },
});

/**
 * Upsert профилей через бот API
 */
const upsertProfiles = async (profilesData) => {
  try {
    const response = await apiClient.post("/bot/profiles/upsert", profilesData);
    return response.data;
  } catch (error) {
    console.error(
      "Error upserting profiles:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

/**
 * Resolve профилей по email
 */
const resolveProfiles = async (emails) => {
  try {
    const response = await apiClient.post("/bot/profiles/resolve", { emails });
    return response.data;
  } catch (error) {
    console.error(
      "Error resolving profiles:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

/**
 * Создать репетицию
 */
const createRehearsal = async (rehearsalData) => {
  try {
    const response = await apiClient.post("/bot/rehearsals", rehearsalData);
    return response.data;
  } catch (error) {
    console.error(
      "Error creating rehearsal:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

/**
 * Установить участников репетиции
 */
const setRehearsalParticipants = async (rehearsalId, participantsData) => {
  try {
    const response = await apiClient.post(
      `/bot/rehearsals/${rehearsalId}/participants`,
      participantsData,
    );
    return response.data;
  } catch (error) {
    console.error(
      "Error setting rehearsal participants:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

/**
 * Получить план репетиции
 */
const getRehearsalPlan = async (rehearsalId) => {
  try {
    const response = await apiClient.post(
      `/bot/rehearsals/${rehearsalId}/plan`,
    );
    return response.data;
  } catch (error) {
    console.error(
      "Error getting rehearsal plan:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

module.exports = {
  upsertProfiles,
  resolveProfiles,
  createRehearsal,
  setRehearsalParticipants,
  getRehearsalPlan,
};
