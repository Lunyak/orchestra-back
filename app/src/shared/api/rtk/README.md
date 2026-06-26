# RTK Query (server-state)

## Принцип: без лишнего контекста

- **Один** `orchestraApi` в Redux (`StoreProvider` уже есть).
- Эндпоинты добавляются через `injectEndpoints` в `features/<domain>/api/*.ts`.
- Страницы и хуки импортируют только нужные `useXQuery` / `useYMutation` — **не** новый React Context.
- Токен берётся в `axiosBaseQuery` из `getAccessToken()` (auth slice + localStorage).

## Client-state остаётся где был

- Сцена, UI форм, календарь, выбранный id — `useState` / существующие slices.
- Server-state (списки, профили, роли) — RTK Query cache + теги.

## Добавить эндпоинт

1. Тип ответа — рядом или из `sync/api/*`.
2. `features/<feature>/api/<feature>-api.ts` → `orchestraApi.injectEndpoints({ ... })`.
3. Импорт файла уже подхватывается через `shared/api/rtk/register-api.ts`.
4. В хуке: `useFooQuery(args, { skip: !token })` вместо `useEffect` + `setState`.

## Миграция

- ✅ `features/rehearsals` — список, шаги, план, CRUD, профили, роли
- ✅ `features/director-sessions` — bundle, save, publish, напоминания, материалы проекта, профили (batch); детальные страницы сессии/слота
- ✅ `features/project` — роли, участники (query + invite / role / remove)
- ✅ `features/team` — `useTeam()` на `useProjectMembersQuery` (settings, board, troupe, sessions)
- ✅ `features/troupe` — `myTroupe`, участники; Kanban — роли + труппа + members
- ✅ `features/project` — CRUD ролей и назначений (`createProjectRole`, `deleteProjectRole`, `setProjectRoleAssignments`)
- ✅ `features/actor` — страница актёра на RTK; аннотации сценария (`actor-notes-api`)
- ✅ `roleWorkbook` thunk — роли/труппа/участники/профили через кэш RTK (`initiate`)
- ✅ `playbook-slice` / `sync.service` — распил на types, thunks, helpers, applier
- ✅ сценарий (`SceneRolesPanel`, `ScriptMarkdownPreview`) и профиль — роли через `useProjectRolesQuery`
- ✅ `ChatDock` — `useMyProfileQuery`
- 🗑️ удалены неиспользуемые `troupe-slice` и `profileRolesSlice` из store
- ⏳ остальные `sync/api/*` (чат, scene notes, sync pull/push, profileData mutations) по мере необходимости

`setupListeners` включён в `shared/store/store.ts` — refetch при фокусе вкладки для подписанных query.

`sync/api/*` остаётся источником типов и для вызовов вне React (thunks, desktop).
