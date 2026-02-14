# 1. Используем официальный образ Node.js
FROM node:18

# 2. Устанавливаем рабочую директорию
WORKDIR /app

# 3. Копируем package.json и package-lock.json
COPY package*.json ./

# 4. Устанавливаем зависимости внутри контейнера (ВАЖНО!)
RUN npm install

# 5. Копируем весь код (после установки зависимостей)
COPY . .

# 6. Открываем порт для health check
EXPOSE 3001

# 7. Запускаем бота
CMD ["npm", "start"]