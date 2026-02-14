const axios = require("axios");
const API_BASE_URL = require("../const/API_BASE_URL");

const getUserData = async (userId) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/users/telegram/${userId}`
    );
    return response.data;
  } catch (error) {
    console.error(
      "Error getting user data:",
      error.response?.data || error.message
    );
    throw error;
  }
};

const getUsersData = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/users`);

    return response.data;
  } catch (error) {
    console.error(
      "Error getting users data:",
      error.response?.data || error.message
    );
    throw error;
  }
};

/**
 * Создает нового пользователя
 * @param {Object} userData - Данные пользователя
 * @returns {Promise} - Результат запроса
 */
const createUserData = async (userData) => {
  console.log(userData);

  try {
    const response = await axios.post(`${API_BASE_URL}/users`, userData);
    return response.data;
  } catch (error) {
    console.error(
      "Error creating user:",
      error.response?.data || error.message
    );
    throw error;
  }
};

const updateUserData = async (telegramId, userData) => {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/users/telegram/${telegramId}`,
      userData
    );
    return response.data;
  } catch (error) {
    console.error(
      "Error updating user data:",
      error.response?.data || error.message
    );
    throw error;
  }
};

/**
 * Получает данные пользователя по его Telegram ID
 * @param {string|number} userId - Telegram ID пользователя
 * @returns {Promise} - Результат запроса
 */

module.exports = {
  updateUserData,
  getUserData,
  createUserData,
  getUsersData,
};
