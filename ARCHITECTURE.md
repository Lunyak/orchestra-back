# Архитектура проекта Orchestra

## Структура монорепозитория

```
orchestra-back/
├── app/src/           # Общая логика (web + mobile через Capacitor)
│   ├── app/           # App shell, роутер, StoreProvider
│   ├── features/      # Домены (FSD-подобно)
│   ├── pages/         # Точки входа маршрутов (часто re-export из features)
│   ├── shared/        # UI-kit, store, RTK, platform
│   └── sync/          # HTTP-клиент, типы, desktop/offline
├── web/               # Vite, entry, proxy
├── mobile/            # Capacitor-оболочка
└── back/              # API-сервер
```

## Принципы

### Монорепозиторий

- **`app/src`** — вся продуктовая логика; `web` и `mobile` только собирают и инициализируют платформу.
- Алиасы: `@app/*`, `@shared/*` (см. `web/tsconfig.json`).

### Features

Каждая фича по возможности:

```
features/<name>/
  api/          # RTK injectEndpoints (server-state)
  model/        # хуки, утилиты, slices
  ui/           # компоненты
  index.ts      # публичный API
```

**Не добавляем** новые React Context для server-state — используем Redux + RTK Query.

### Pages

- **`pages/<route>/`** — тонкий слой для роутера: re-export `FeaturePage` или обёртка.
- Бизнес-логика страницы — в `features/*/model/use*Page.ts` + `features/*/ui/*Page.tsx`.

### Client-state vs server-state

| Тип | Где |
|-----|-----|
| Списки, профили, роли, участники проекта | RTK Query (`orchestraApi`) |
| Сцена, черновики шагов, UI панелей | Redux slices + локальный `useState` |
| Auth token | auth slice + `getAccessToken()` в `axiosBaseQuery` |

Подробнее: `app/src/shared/api/rtk/README.md`.

## Features (актуально)

| Feature | Назначение |
|---------|------------|
| `auth` | Вход, токен |
| `project` | Текущий проект, RTK: roles, members |
| `scene` | Сцена, шаги, sync runner, thunks |
| `script-ui` | Плейлист, панели, edit mode |
| `team` | `useTeam()` — участники на settings/board/troupe/sessions |
| `spectacle` | Оболочка главной страницы (вкладки script/theater/board/…) |
| `theater` | 3D театр (заморожен по рефакторингу) |
| `rehearsals` | Репетиции + RTK |
| `director-sessions` | Сессии режиссёра + RTK |
| `troupe` | Расписание труппы, RTK `myTroupe` + `useTroupePage` |
| `profile`, `role-workbook`, `kanban` (model) | По доменам |

## RTK Query

- Единый API: `shared/api/rtk/orchestra-api.ts`.
- Регистрация эндпоинтов: side-effect импорты в `shared/api/rtk/register-api.ts`.
- `setupListeners(store.dispatch)` в `shared/store/store.ts` — обновление при возврате на вкладку.

Добавление эндпоинта:

1. `features/<domain>/api/*-api.ts` → `orchestraApi.injectEndpoints`.
2. Импорт файла уже есть в `register-api.ts` (или добавить строку).
3. В хуке: `useXQuery(slug, { skip: !token || !slug })`.

## Маршрутизация

1. `web/src/main.tsx` → `App` из `app/src/app/App.tsx`.
2. `App` — провайдеры (`StoreProvider`, Auth, Project, Scene, …) + `AppRoutes`.
3. `app/src/app/router/AppRouteDeclarations.tsx` — lazy-импорты из `pages/*`.

## Новая страница

1. `features/foo/ui/FooPage.tsx` + при необходимости `model/useFooPage.ts`.
2. `pages/foo/FooPage.tsx` → `export { FooPage } from "../../features/foo";`
3. Lazy-роут в `AppRouteDeclarations.tsx`.

## sync/api

Остаётся для:

- типов ответов;
- вызовов вне React (thunks, desktop, prefetch);
- постепенной миграции UI на RTK по мере касания экрана.

3D театр и тяжёлый scene sync не трогаем без отдельной задачи.
