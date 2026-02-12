# Архитектура проекта Orchestra

## 📁 Структура проекта

```
orchestra-servises/
├── app/          # 🎯 ОСНОВНАЯ ЛОГИКА ПРИЛОЖЕНИЯ (shared code)
│   └── src/
│       ├── App.tsx           # Корневой компонент с провайдерами
│       ├── routes.tsx        # Конфигурация маршрутов
│       ├── features/         # Фичи приложения (Feature-Sliced Design)
│       │   ├── auth/        # Аутентификация
│       │   ├── project/     # Управление проектами
│       │   ├── scene/       # Управление сценами
│       │   ├── script-ui/   # UI состояние скрипта
│       │   └── team/        # Команда проекта
│       ├── pages/           # Страницы приложения
│       │   ├── login/
│       │   ├── spectacle/   # Главная страница спектакля
│       │   ├── rehearsals/  # Страница репетиций
│       │   ├── profile/     # Профиль пользователя
│       │   └── settings/    # Настройки
│       ├── components/      # Переиспользуемые UI компоненты
│       ├── shared/          # Общие типы и утилиты
│       │   ├── types/
│       │   ├── utils/
│       │   └── platform/
│       └── sync/            # API и синхронизация
│
├── web/          # 🌐 WEB платформа
│   └── src/
│       ├── main.tsx         # Entry point
│       ├── AppShell.tsx     # Обёртка, импортирует @app/App
│       └── components/
│           └── AppErrorBoundary.tsx  # Error boundary для web
│
├── desktop/      # 💻 DESKTOP платформа (Electron)
│   └── src/
│       ├── App.tsx          # Desktop обёртка с локальной синхронизацией
│       └── sync/
│           └── localPush.ts # Синхронизация локальных данных
│
├── admin/        # 👤 ADMIN панель
└── back/         # ⚙️ BACKEND (Node.js)
```

## 🎯 Принципы организации кода

### 1. Монорепозиторий с shared code

- **`/app/`** — основная логика, компоненты, фичи (используется web + desktop)
- **`/web/`** — специфичные для web вещи (entry point, error boundary)
- **`/desktop/`** — специфичные для desktop вещи (локальная синхронизация)

### 2. Feature-Sliced Design в папке features

Каждая фича содержит:
- `model/` — логика (контексты, хуки)
- `ui/` — компоненты (если есть)
- `index.ts` — публичное API фичи

### 3. Разделение ответственности

- **App.tsx** — только провайдеры и layout
- **routes.tsx** — маршруты и lazy-импорты страниц
- **pages/** — страницы с бизнес-логикой
- **components/** — переиспользуемые UI компоненты
- **features/** — изолированные фичи с логикой

### 4. Импорты

Настроены алиасы в `tsconfig.json`:
```json
{
  "paths": {
    "@app": ["../app/src"],
    "@app/*": ["../app/src/*"],
    "@shared": ["../app/src/shared"],
    "@shared/*": ["../app/src/shared/*"]
  }
}
```

## 🔄 Как работает маршрутизация

1. **Entry point** (`web/src/main.tsx` или `desktop/src/main.tsx`)
   - Создаёт `<HashRouter>`
   - Оборачивает в `<AppErrorBoundary>`
   - Рендерит `<App />` из `@app/App`

2. **App.tsx** (`app/src/App.tsx`)
   - Настраивает провайдеры (Auth, Platform, Project, Scene, ScriptUI)
   - Проверяет аутентификацию
   - Рендерит `<AppRoutes />`

3. **routes.tsx** (`app/src/routes.tsx`)
   - Содержит все lazy-импорты страниц
   - Определяет роуты через `<Routes>` и `<Route>`
   - Обёрнуто в `<Suspense>` для lazy-загрузки

## 🧹 Что было удалено

После рефакторинга удалены дубликаты:

- ❌ `/web/src/App.tsx` (старый, 1275 строк) → переименован в `App.tsx.old`
- ❌ `/web/src/App.css` (старый) → переименован в `App.css.old`
- ❌ `/web/src/components/profile/` → переименован в `profile.old`
- ❌ `/web/src/components/rehearsals/` → переименован в `rehearsals.old`
- ❌ `/web/src/components/theater/` → переименован в `theater.old`

Все эти файлы теперь находятся в `/app/src/`.

## ✅ Преимущества новой структуры

1. **Один источник правды** — вся логика в `/app/`, нет дублирования
2. **Чистый App.tsx** — только провайдеры, без роутов
3. **Явные роуты** — все маршруты видны в одном файле `routes.tsx`
4. **Feature-Sliced Design** — изолированные фичи с чётким API
5. **Легко масштабировать** — добавление новой страницы = 1 файл в `pages/` + 1 роут в `routes.tsx`

## 🚀 Как добавить новую страницу

1. Создать компонент страницы в `app/src/pages/my-page/MyPage.tsx`
2. Добавить lazy-импорт в `app/src/routes.tsx`:
   ```tsx
   const MyPage = lazy(() => 
     import("./pages/my-page/MyPage").then(m => ({ default: m.MyPage }))
   );
   ```
3. Добавить роут:
   ```tsx
   <Route path="/my-page" element={<MyPage />} />
   ```

Готово! Страница доступна и в web, и в desktop.
