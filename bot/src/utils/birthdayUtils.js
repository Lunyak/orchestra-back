/**
 * Утилиты для работы с днями рождения
 */

const { getUsersData } = require("../api/userApi");

/**
 * Преобразует дату в любом формате в объект Date
 * @param {string} dateStr - Дата в строковом формате
 * @returns {Date|null} - Объект Date или null, если формат не поддерживается
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  // Поддерживаемые разделители: ., -, /
  const regex = /^(\d{1,4})[.\-/](\d{1,2})[.\-/](\d{1,4})$/;
  const match = dateStr.match(regex);

  if (!match) {
    console.error(`Unsupported date format: ${dateStr}`);
    return null;
  }

  const [, part1, part2, part3] = match;

  // Определяем, какой формат используется:
  // Если первая часть больше 31, это YYYY-MM-DD
  if (part1.length === 4) {
    return new Date(`${part1}-${part2}-${part3}`);
  }

  // Если третья часть больше 31, это DD.MM.YYYY или DD-MM-YYYY
  if (part3.length === 4) {
    return new Date(`${part3}-${part2}-${part1}`);
  }

  // Если ни одна часть не является годом, предполагаем DD.MM.YYYY
  return new Date(`20${part3}-${part2}-${part1}`);
}

/**
 * Проверяет, является ли сегодня днем рождения пользователя
 * @param {string} birthDate - Дата рождения в любом формате
 * @returns {boolean} - true, если сегодня день рождения
 */
function isBirthdayToday(birthDate) {
  const birth = parseDate(birthDate);
  if (!birth) return false;

  const today = new Date();
  return (
    today.getMonth() === birth.getMonth() && today.getDate() === birth.getDate()
  );
}

/**
 * Форматирует возраст из даты рождения
 * @param {string} birthDate - Дата рождения в любом формате
 * @returns {number} - Возраст
 */
function calculateAge(birthDate) {
  const birth = parseDate(birthDate);
  if (!birth) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

async function findBirthdayPeople() {
  try {
    const response = await getUsersData();

    const birthdayPeople = response.filter(
      (user) => user.birthday && isBirthdayToday(user.birthday),
    );

    console.log("Birthday people today:", birthdayPeople); // Логируем именинников
    return birthdayPeople;
  } catch (error) {
    console.error("Error finding birthday people:", error);
    return [];
  }
}

/**
 * Вычисляет дату следующего дня рождения (в этом или следующем году)
 * @param {string} birthDateStr - Дата рождения
 * @returns {{ nextDate: Date, daysUntil: number } | null}
 */
function getNextBirthday(birthDateStr) {
  const birth = parseDate(birthDateStr);
  if (!birth) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < today) {
    next = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
  }

  const daysUntil = Math.ceil((next - today) / (1000 * 60 * 60 * 24));
  return { nextDate: next, daysUntil };
}

/**
 * Форматирует дату для отображения (ДД.ММ)
 * @param {Date} date
 * @returns {string}
 */
function formatDateShort(date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}.${m}`;
}

/**
 * Возвращает всех участников с днём рождения, отсортированных по ближайшей дате
 * @returns {Promise<Array<{ name: string, surname: string, birthday: string, nextDate: Date, daysUntil: number }>>}
 */
async function getAllBirthdaysSorted() {
  try {
    const users = await getUsersData();
    const withBirthday = users
      .filter((u) => u.birthday && parseDate(u.birthday))
      .map((u) => {
        const next = getNextBirthday(u.birthday);
        if (!next) return null;
        const name = [u.name, u.surname].filter(Boolean).join(" ") || "—";
        return {
          name,
          surname: u.surname || "",
          birthday: u.birthday,
          nextDate: next.nextDate,
          daysUntil: next.daysUntil,
        };
      })
      .filter(Boolean);

    withBirthday.sort((a, b) => a.daysUntil - b.daysUntil);
    return withBirthday;
  } catch (error) {
    console.error("Error getting all birthdays:", error);
    return [];
  }
}

module.exports = {
  isBirthdayToday,
  findBirthdayPeople,
  calculateAge,
  parseDate,
  getNextBirthday,
  formatDateShort,
  getAllBirthdaysSorted,
};
