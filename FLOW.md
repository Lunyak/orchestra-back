# 🔄 Поток выполнения приложения

## 📱 Web платформа

```
web/src/main.tsx
    │
    ├─> ReactDOM.createRoot()
    │
    └─> <HashRouter>
           │
           └─> <AppErrorBoundary>
                  │
                  └─> <App /> ──────────┐
                                        │
                                        ▼
                              app/src/App.tsx
                                        │
                    ┌───────────────────┼────────────────────┐
                    │                   │                    │
                    ▼                   ▼                    ▼
            <PlatformProvider>  <AuthProvider>    <AuthenticatedApp>
                    │                   │                    │
                    │                   │                    ├─> if !accessToken
                    │                   │                    │   └─> <LoginPage>
                    │                   │                    │
                    │                   │                    └─> if accessToken
                    │                   │                        │
                    │                   │         ┌──────────────┼────────────────┐
                    │                   │         │              │                │
                    │                   │         ▼              ▼                ▼
                    │                   │   <ProjectProvider> <SceneProvider> <ScriptUIProvider>
                    │                   │         │              │                │
                    │                   │         └──────────────┼────────────────┘
                    │                   │                        │
                    │                   │                        ▼
                    │                   │                 app/src/routes.tsx
                    │                   │                        │
                    │                   │                        └─> <Suspense>
                    │                   │                               │
                    │                   │                               └─> <Routes>
                    │                   │                                      │
                    │                   │                    ┌─────────────────┼─────────────────┐
                    │                   │                    │                 │                 │
                    │                   │                    ▼                 ▼                 ▼
                    │                   │              <SpectaclePage>  <RehearsalsPage>  <ProfilePage>
                    │                   │                    │                 │                 │
                    │                   │                    └─────────────────┴─────────────────┘
                    │                   │                                      │
                    │                   │                                      ▼
                    │                   │                            app/src/pages/...
                    │                   │
                    └───────────────────┴─> Доступны через хуки:
                                              - useAuth()
                                              - usePlatform()
                                              - useProject()
                                              - useScene()
                                              - useScriptUI()
                                              - useTeam()
```

## 💻 Desktop платформа

```
desktop/src/main.tsx
    │
    └─> <HashRouter>
           │
           └─> <DesktopApp> ────────────┐
                                        │
                                        ▼
                            desktop/src/App.tsx
                                        │
                                        └─> <App                      ← из @app/App
                                              onAfterLogin={pushAllLocalToServer}
                                              onPushAllLocal={pushAllLocalToServer}
                                            />
                                              │
                                              ▼
                                    (далее как в web, см. выше)
                                    app/src/App.tsx → routes.tsx → pages/
```

## 🎯 Ключевые моменты

### 1. Entry Points
- **Web:** `web/src/main.tsx` → `web/src/AppShell.tsx` → `@app/App`
- **Desktop:** `desktop/src/main.tsx` → `desktop/src/App.tsx` → `@app/App`

### 2. Провайдеры (app/src/App.tsx)
Порядок важен! Каждый следующий может использовать предыдущий:
1. `PlatformProvider` — платформо-специфичные функции (desktop push)
2. `AuthProvider` — аутентификация, accessToken
3. `ProjectProvider` — текущий проект
4. `SceneProvider` — данные сцены
5. `ScriptUIProvider` — UI состояние (шаги, страницы и т.д.)

### 3. Маршрутизация (app/src/routes.tsx)
- Все роуты в одном месте
- Lazy-загрузка страниц (code splitting)
- Suspense с fallback

### 4. Доступ к состоянию
Любой компонент может использовать хуки:
```tsx
import { useAuth } from "@app/features/auth";
import { useProject } from "@app/features/project";
import { useScene } from "@app/features/scene";

function MyComponent() {
  const { accessToken, login } = useAuth();
  const { projectName, setProjectName } = useProject();
  const { sceneData, steps } = useScene();
  // ...
}
```

## 📂 Где что искать

| Что нужно | Где находится |
|-----------|---------------|
| Роуты | `app/src/routes.tsx` |
| Провайдеры | `app/src/App.tsx` |
| Страницы | `app/src/pages/` |
| Компоненты | `app/src/components/` |
| Фичи/хуки | `app/src/features/` |
| Типы | `app/src/shared/types/` |
| API | `app/src/sync/api.ts` |
| Аутентификация | `app/src/sync/auth.ts` |

## 🔍 Пример: Добавление новой фичи

Допустим, нужна фича "Comments" (комментарии):

1. **Создать структуру:**
   ```
   app/src/features/comments/
   ├── model/
   │   └── comments-context.tsx   # Контекст + хук useComments
   ├── ui/
   │   └── CommentsList.tsx       # Компонент списка
   └── index.ts                   # export { useComments }
   ```

2. **Добавить провайдер в App.tsx:**
   ```tsx
   import { CommentsProvider } from "./features/comments";
   
   // В AuthenticatedApp:
   <ScriptUIProvider>
     <CommentsProvider>
       <AppRoutes />
     </CommentsProvider>
   </ScriptUIProvider>
   ```

3. **Использовать в компонентах:**
   ```tsx
   import { useComments } from "@app/features/comments";
   
   const { comments, addComment } = useComments();
   ```

## 🚀 Производительность

Благодаря lazy-загрузке:
- **Начальный bundle:** ~221 KB (gzip: 74 KB)
- **SpectaclePage:** ~33 KB (загружается по требованию)
- **ShowScript:** ~130 KB (загружается только на странице скрипта)
- **TheaterScene:** ~1136 KB (загружается только на странице театра)

Каждая страница загружается только когда пользователь переходит на неё!
