# Orchestra — мобильное приложение (Android / iOS)

Приложение собирается через **Capacitor**: тот же React-код, что и веб (`app/` + `web/`), с **локальным хранением** сценария, плейлиста и звуков для работы **без интернета** на спектакле.

## Что уже работает

- Синхронизация с сервером при наличии сети (`/sync`)
- Кнопка **«Скачать для спектакля»** на странице спектакля (только в нативной сборке)
- Сохранение `script.json` и медиа в память телефона
- Воспроизведение музыки и звуков из локальных файлов без сети
- При ошибке сети — загрузка последнего локального пакета

## Требования

- **Node.js** 18+
- **Android:** [Android Studio](https://developer.android.com/studio) + SDK
- **iPhone:** macOS + [Xcode](https://developer.apple.com/xcode/) (сборка iOS только на Mac)

## 1. Установка зависимостей

Из корня репозитория:

```bash
cd web
npm install

cd ../mobile
npm install
```

## 2. URL API сервера

Отредактируйте `web/.env.mobile` (или скопируйте из `web/.env.mobile.example`):

```env
VITE_API_BASE_URL=http://213.226.126.196:3000
VITE_CAPACITOR=1
```

Укажите **полный** адрес бэкенда (с портом или `https://ваш-домен/api`), не относительный `/api`.

## 3. Сборка веб-части и синхронизация Capacitor

```bash
cd mobile
npm run cap:sync
```

Команда собирает `web/dist` и копирует в проекты `android/` и `ios/`.

## 4. Установка на телефон

### Android

1. Откройте проект в Android Studio:

   ```bash
   cd mobile
   npm run cap:open:android
   ```

2. Подключите телефон по USB (режим разработчика + отладка по USB) **или** запустите эмулятор.
3. В Android Studio: **Run** (зелёный треугольник) → приложение установится.

Альтернатива из терминала (если настроен SDK):

```bash
cd mobile
npm run android
```

**APK для раздачи актёрам:** Android Studio → **Build → Build Bundle(s) / APK(s) → Build APK(s)**. Файл будет в `mobile/android/app/build/outputs/apk/`.

### iPhone (только на Mac)

1. Установите CocoaPods: `sudo gem install cocoapods` (если ещё нет).
2. Первый раз:

   ```bash
   cd mobile
   npm run cap:sync
   cd ios/App
   pod install
   cd ../../..
   npm run cap:open:ios
   ```

3. В Xcode выберите свою команду (Signing & Capabilities → Team).
4. Подключите iPhone → **Run**.

Для установки без Mac нужен облачный CI или TestFlight после сборки на Mac.

## 5. Как пользоваться офлайн

1. При **есть интернет**: войти в аккаунт, выбрать проект.
2. Нажать **«Скачать для спектакля»** и дождаться синхронизации (медиа качаются в фоне).
3. На спектакле **без сети**: открыть приложение → тот же проект → текст и музыка из памяти телефона.

Повторяйте «Скачать для спектакля» после изменений на сервере.

## Обновление приложения после изменений в коде

```bash
cd mobile
npm run cap:sync
```

Затем снова Run в Android Studio / Xcode.

## Структура

| Путь | Назначение |
|------|------------|
| `app/src/shared/platform/mobile/` | Файлы на телефоне, `window.api` |
| `app/src/sync/desktopPrefetchOffline.ts` | Загрузка медиа (общая с Electron) |
| `mobile/capacitor.config.ts` | id приложения, `webDir` |
| `web/.env.mobile` | API URL для мобильной сборки |

## Устранение неполадок

- **Не логинится** — проверьте `VITE_API_BASE_URL`, доступность сервера с телефона по Wi‑Fi/мобильной сети.
- **Нет звука офлайн** — сначала «Скачать для спектакля» при включённом интернете.
- **CORS** — на бэкенде `origin: true`, Capacitor обычно проходит.
