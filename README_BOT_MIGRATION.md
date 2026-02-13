# 🎭 Telegram-бота из Dophamin в Orchestra

## 🚀 Быстрый старт

### 1. Настройте переменные окружения

Откройте `back/.env` и добавьте:

```env
BOT_TOKEN=<ваш_токен_от_BotFather>
OWNER_TELEGRAM_ID=<ваш_telegram_id>
```

orchestra-servises/
├── back/
│   ├── src/
│   │   ├── telegram/                    # 🆕 Модуль бота
│   │   │   ├── telegram.module.ts
│   │   │   ├── telegram.service.ts
│   │   │   └── services/
│   │   │       ├── attendance.service.ts
│   │   │       └── profile.service.ts
│   │   ├── profile/                     # Обновлен для бота
│   │   ├── rehearsals/                  # Обновлен для бота
│   │   └── bot/                         # API для бота
│   ├── prisma/
│   │   ├── schema.prisma                # 🆕 Добавлены поля для бота
│   │   └── migrations/
│   │       └── 20260213_create_missing_tables/
│   ├── .env                             # 🆕 BOT_TOKEN, OWNER_TELEGRAM_ID
│   ├── .env.example                     # 🆕 Пример конфигурации
│   ├── TELEGRAM_BOT_README.md           # 🆕 Документация бота
│   └── scripts/
│       └── migrate-from-dophamin.md     # 🆕 Инструкция по миграции
├── MIGRATION_SUMMARY.md                 # 🆕 Сводка изменений
└── README_BOT_MIGRATION.md              # 🆕 Этот файл
```