# 📝 Памятка по рефакторингу

## ✅ Что было сделано

### Web + Desktop — едина архитектура!

```
БЫЛО:                          СТАЛО:
─────────────────────         ───────────────────────

web/src/App.tsx               app/src/App.tsx
  1275 строк 😱                  44 строки ✅
  - роуты                         - только провайдеры
  - lazy-импорты                  
  - логика                     app/src/routes.tsx
  - компоненты                    48 строк ✅
                                  - роуты
desktop/src/                      - lazy-импорты
  app-types/ 🗑️                   
  shared/ 🗑️                   web/src/
                                  - main.tsx
web/src/components/               - AppShell.tsx
  profile/ 🗑️                      - AppErrorBoundary.tsx
  rehearsals/ 🗑️               
  theater/ 🗑️                  desktop/src/
                                  - main.tsx
                                  - App.tsx
                                  - sync/localPush.ts
```

### Ключевые изменения

1. **`/app/src/routes.tsx`** — создан файл с роутами ✅
2. **`/app/src/App.tsx`** — упрощён до 44 строк ✅
3. **`/web/src/`** — удалены дубликаты компонентов ✅
4. **`/desktop/src/`** — удалены app-types и shared ✅
5. **TypeScript** — унифицирована конфигурация ✅

---

## 🎯 Как теперь работает

### 1. Entry Points

```tsx
// web/src/main.tsx
<HashRouter>
  <AppErrorBoundary>
    <App />  ← из @app/App
  </AppErrorBoundary>
</HashRouter>

// desktop/src/main.tsx
<HashRouter>
  <DesktopApp />  ← оборачивает @app/App
</HashRouter>
```

### 2. Провайдеры (app/src/App.tsx)

```tsx
<PlatformProvider>        ← Desktop-специфичные функции
  <AuthProvider>          ← Аутентификация
    <ProjectProvider>     ← Текущий проект
      <SceneProvider>     ← Данные сцены
        <ScriptUIProvider>← UI состояние
          <AppRoutes />   ← Роуты из routes.tsx
```

### 3. Роуты (app/src/routes.tsx)

```tsx
<Suspense fallback="Loading...">
  <Routes>
    <Route path="/" element={<SpectaclePage />} />
    <Route path="/rehearsals" element={<RehearsalsPage />} />
    <Route path="/profile" element={<ProfilePage />} />
    {/* ... */}
  </Routes>
</Suspense>
```

---

## 📂 Где что искать

| Что нужно | Где находится |
|-----------|---------------|
| 🔀 Роуты | `app/src/routes.tsx` |
| 🔌 Провайдеры | `app/src/App.tsx` |
| 📄 Страницы | `app/src/pages/` |
| 🧩 Компоненты | `app/src/components/` |
| 🎯 Фичи/хуки | `app/src/features/` |
| 📦 Типы | `app/src/shared/types/` |
| 🌐 API | `app/src/sync/api.ts` |
| 🔐 Auth | `app/src/sync/auth.ts` |

---

## 🚀 Как добавить новую страницу

### Шаг 1: Создать файл страницы

```tsx
// app/src/pages/my-page/MyPage.tsx
export function MyPage() {
  return <div>My Page Content</div>;
}
```

### Шаг 2: Добавить в routes.tsx

```tsx
// app/src/routes.tsx

// 1. Добавить lazy-импорт
const MyPage = lazy(() =>
  import("./pages/my-page/MyPage").then(m => ({ default: m.MyPage }))
);

// 2. Добавить роут
export function AppRoutes() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        {/* ... существующие роуты ... */}
        <Route path="/my-page" element={<MyPage />} />
      </Routes>
    </Suspense>
  );
}
```

**Готово!** Страница работает и в web, и в desktop 🎉

---

## 🧪 Проверка сборки

```bash
# Web
cd web && npm run build

# Desktop
cd desktop && npm run build
```

---

## 🗑️ Что можно удалить через неделю

Если всё работает стабильно:

```bash
cd web/src
rm -rf App.tsx.old App.css.old
rm -rf components/*.old
```

---

## 📚 Документация

- **`ARCHITECTURE.md`** — полное описание архитектуры
- **`FLOW.md`** — схема потока выполнения
- **`DESKTOP_CLEANUP.md`** — детали очистки desktop
- **`REFACTORING_COMPLETE.md`** — полная сводка изменений

---

## 💡 Лучшие практики

### ✅ DO (делай)

- Создавай страницы в `app/src/pages/`
- Создавай компоненты в `app/src/components/`
- Используй фичи в `app/src/features/`
- Добавляй роуты в `app/src/routes.tsx`

### ❌ DON'T (не делай)

- ~~Не создавай компоненты в `web/src/components/`~~ (кроме web-специфичных)
- ~~Не создавай дубликаты в `desktop/src/`~~ 
- ~~Не дублируй типы~~ (используй `@app` и `@shared`)
- ~~Не добавляй роуты прямо в `App.tsx`~~ (только в `routes.tsx`)

---

## 🎉 Результат

✅ **Один источник правды** — вся логика в `/app/src/`  
✅ **Чистый код** — каждый файл делает одно дело  
✅ **Легко масштабировать** — добавление страницы = 2 строки кода  
✅ **Унифицировано** — web и desktop используют одинаковый подход  

**Приятной разработки!** 🚀
