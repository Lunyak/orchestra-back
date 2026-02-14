const axios = require("axios");
const API_BASE_URL = require("../const/API_BASE_URL");

/**
 * Получает профиль пользователя по Telegram ID
 * @param {string|number} telegramId - Telegram ID пользователя
 * @returns {Promise} - Профиль пользователя или null если не найден
 */
const getUserData = async (telegramId) => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/profile/telegram/${telegramId}`
    );
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      // Пользователь не найден - это нормально для незарегистрированных
      return null;
    }
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
 * Создает профиль пользователя по Telegram ID
 * @param {Object} userData - Данные профиля пользователя
 * @param {string} userData.telegram_id - Telegram ID (обязательно)
 * @returns {Promise} - Созданный профиль
 */
const createUserData = async (userData) => {
  const telegramId = userData.telegram_id;
  if (!telegramId) {
    throw new Error("telegram_id is required");
  }

  // Преобразуем поля для нового API
  const profileData = {
    email: userData.email,
    firstName: userData.name,
    lastName: userData.surname,
    telegramUsername: userData.telegram_username,
    phone: userData.phone,
    sex: userData.sex,
    birthday: userData.birthday,
    role: userData.role,
  };

  try {
    const response = await axios.post(
      `${API_BASE_URL}/profile/telegram/${telegramId}`,
      profileData
    );
    return response.data;
  } catch (error) {
    console.error(
      "Error creating user profile:",
      error.response?.data || error.message
    );
    throw error;
  }
};

/**
 * Обновляет профиль пользователя по Telegram ID
 * @param {string|number} telegramId - Telegram ID
 * @param {Object} userData - Данные для обновления
 * @returns {Promise} - Обновленный профиль
 */
const updateUserData = async (telegramId, userData) => {
  // Преобразуем поля для нового API если нужно
  const profileData = {
    email: userData.email,
    firstName: userData.name || userData.firstName,
    lastName: userData.surname || userData.lastName,
    telegramUsername: userData.telegram_username || userData.telegramUsername,
    phone: userData.phone,
    sex: userData.sex,
    birthday: userData.birthday,
    role: userData.role,
    characters: userData.characters,
    displayName: userData.displayName,
  };

  try {
    const response = await axios.patch(
      `${API_BASE_URL}/profile/telegram/${telegramId}`,
      profileData
    );
    return response.data;
  } catch (error) {
    console.error(
      "Error updating user profile:",
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
