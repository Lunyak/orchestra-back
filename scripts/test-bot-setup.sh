#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Проверка настройки бота Orchestra"
echo "===================================="
echo ""

# Счетчики
PASSED=0
FAILED=0

# Функция для проверки
check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        ((FAILED++))
    fi
}

# Функция для проверки существования файла
check_file() {
    if [ -f "$1" ]; then
        check 0 "Файл существует: $1"
    else
        check 1 "Файл НЕ найден: $1"
    fi
}

# Функция для проверки содержимого файла
check_content() {
    if grep -q "$2" "$1" 2>/dev/null; then
        check 0 "Содержимое в $1: найдено '$2'"
    else
        check 1 "Содержимое в $1: НЕ найдено '$2'"
    fi
}

echo "1️⃣  Проверка структуры проекта"
echo "--------------------------------"
check_file "bot/bot.js"
check_file "bot/package.json"
check_file "bot/Dockerfile"
check_file "bot/.env.example"
check_file "bot/.gitignore"
check_file "bot/.dockerignore"
check_file "bot/README.md"
check_file "bot/src/const/API_BASE_URL.js"
check_file "bot/src/api/userApi.js"
echo ""

echo "2️⃣  Проверка конфигурации Dockerfile"
echo "-------------------------------------"
check_content "bot/Dockerfile" "CMD"
check_content "bot/Dockerfile" "EXPOSE 3001"
echo ""

echo "3️⃣  Проверка .env файлов"
echo "-------------------------"
check_file "bot/.env"
check_content "bot/.env" "SERVER_URL=back:3000"
check_content "bot/.env" "HEALTH_PORT=3001"
check_content "bot/.env.example" "BOT_TOKEN="
check_content "bot/.env.example" "SERVER_URL="
echo ""

echo "4️⃣  Проверка docker-compose.yml"
echo "---------------------------------"
check_content "docker-compose.yml" "bot:"
check_content "docker-compose.yml" "container_name: orkestr-bot"
check_content "docker-compose.yml" "SERVER_URL: back:3000"
check_content "docker-compose.yml" "healthcheck:"
echo ""

echo "5️⃣  Проверка CI/CD"
echo "-------------------"
check_content ".gitlab-ci.yml" "bot"
check_content ".gitlab-ci.yml" "docker compose up -d --build postgres back bot dozzle"
echo ""

echo "6️⃣  Проверка безопасности"
echo "--------------------------"
check_content "bot/.gitignore" "google-secret.json"
check_content "bot/.gitignore" ".env"
echo ""

echo "7️⃣  Проверка документации"
echo "--------------------------"
check_file "bot/README.md"
check_file "docs/LOGS.md"
check_file "DEPLOYMENT.md"
check_file "BOT_CHECKLIST.md"
check_file "BOT_MIGRATION_SUMMARY.md"
check_content "README.md" "bot/"
check_content "README.md" "Telegram бот"
echo ""

echo "8️⃣  Проверка корневых конфигураций"
echo "------------------------------------"
check_content ".env" "BOT_TOKEN="
check_content ".env" "OWNER_TELEGRAM_ID="
check_content ".env" "GROUP_CHAT_ID="
check_content ".env" "SPREADSHEET_ID="
check_content ".env.example" "BOT_TOKEN="
check_content ".env.example" "OWNER_TELEGRAM_ID="
echo ""

echo "9️⃣  Проверка API интеграции"
echo "----------------------------"
check_content "bot/src/const/API_BASE_URL.js" "process.env.SERVER_URL"
check_content "bot/src/api/userApi.js" "API_BASE_URL"
check_content "bot/src/api/userApi.js" "getUserData"
check_content "bot/src/api/userApi.js" "createUserData"
echo ""

echo "🔟 Проверка Health Check"
echo "------------------------"
check_content "bot/bot.js" "HEALTH_PORT"
check_content "bot/bot.js" "startHealthServer"
check_content "bot/bot.js" "/health"
echo ""

echo "=================================="
echo "📊 РЕЗУЛЬТАТЫ"
echo "=================================="
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ!${NC}"
    echo ""
    echo "Бот готов к деплою:"
    echo "  git add ."
    echo "  git commit -m 'feat: add Telegram bot integration'"
    echo "  git push origin master"
    exit 0
else
    echo -e "${RED}⚠️  ЕСТЬ ОШИБКИ!${NC}"
    echo ""
    echo "Пожалуйста, исправьте проблемы перед деплоем."
    exit 1
fi
