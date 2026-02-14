const { google } = require("googleapis");
const sheets = google.sheets("v4");
const SERVICE_ACCOUNT_KEY = require("../googleSheets/configs/google-secret.json");

// Авторизация через сервисный аккаунт
async function authorize() {
  const authClient = new google.auth.JWT({
    email: SERVICE_ACCOUNT_KEY.client_email,
    key: SERVICE_ACCOUNT_KEY.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  await authClient.authorize();
  return authClient;
}

// Запись данных гостя в Google Таблицу
async function addGuest(guestData, sheetName) {
  try {
    const auth = await authorize();
    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.SPREADSHEET_ID;
    const range = `${sheetName}!A:D`; // Диапазон для добавления данных

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      resource: {
        values: [guestData], // Данные гостя
      },
    });

    console.log("Гость успешно добавлен:", response.data);
    return response.data;
  } catch (error) {
    console.error("Ошибка при добавлении гостя:", error);
    throw error;
  }
}

// Получение метаданных таблицы (список листов с id и названиями)
async function getSpreadsheet() {
  try {
    const auth = await authorize();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    return {
      spreadsheetId,
      sheets: response.data.sheets.map((s) => ({
        sheetId: s.properties.sheetId,
        title: s.properties.title,
      })),
    };
  } catch (error) {
    console.error("Ошибка при получении таблицы:", error);
    throw error;
  }
}

// Создание новой страницы: копирование выбранного листа, очистка гостей (A:D), переименование
async function createSheetFromTemplate(sourceSheetName, newSheetName) {
  try {
    const auth = await authorize();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const { sheets: sheetList } = await getSpreadsheet();
    const sourceSheet = sheetList.find((s) => s.title === sourceSheetName);
    if (!sourceSheet) {
      throw new Error(`Лист "${sourceSheetName}" не найден`);
    }

    // 1. Копируем лист с новым именем
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            duplicateSheet: {
              sourceSheetId: sourceSheet.sheetId,
              newSheetName,
            },
          },
        ],
      },
    });

    // 2. Очищаем данные со 2-й строки, но оставляем F4 (счётчик мест).
    const escapedName = newSheetName.replace(/'/g, "''");
    const prefix = `'${escapedName}'!`;
    const ranges = [
      `${prefix}A2:E1000`, // A–E
      `${prefix}F2:F3`, // F выше счётчика
      `${prefix}F5:F1000`, // F ниже счётчика
      `${prefix}G2:Z1000`, // G–Z
    ];
    for (const range of ranges) {
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range,
      });
    }

    return true;
  } catch (error) {
    console.error("Ошибка при создании страницы:", error);
    throw error;
  }
}

// Получение данных гостей из Google Таблицы
async function getGuestsApi(sheetName = "Лист1") {
  // Установим значение по умолчанию
  try {
    if (!sheetName) {
      throw new Error("Не указано имя листа (sheetName)");
    }

    const auth = await authorize();
    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.SPREADSHEET_ID;
    const range = `${sheetName}!A:D`; // Диапазон данных (такой же, как при добавлении)

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return response.data.values || []; // Возвращаем данные или пустой массив
  } catch (error) {
    console.error("Ошибка при получении данных:", error);
    throw error;
  }
}

module.exports = {
  addGuest,
  getGuestsApi,
  getSpreadsheet,
  createSheetFromTemplate,
};
