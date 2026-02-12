# Система дизайна Orchestra - CSS переменные

Этот файл содержит все централизованные CSS переменные для проекта Orchestra.

## Использование

### 1. Импорт в ваш главный CSS файл

```css
/* В app/src/index.css или app/src/App.css */
@import './shared/styles/index.css';
```

### 2. Использование переменных в CSS файлах

```css
.my-component {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  padding: var(--spacing-6);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-default);
  transition: var(--transition-smooth);
}

.my-button {
  background: var(--color-primary);
  color: var(--color-text-white);
  padding: var(--spacing-3) var(--spacing-5);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
}

.my-button:hover {
  background: var(--color-primary-dark);
}
```

### 3. Использование в inline стилях (React/JS)

```jsx
<div style={{
  backgroundColor: 'var(--color-bg-secondary)',
  padding: 'var(--spacing-6)',
  borderRadius: 'var(--radius-lg)',
}}>
  Контент
</div>
```

## Категории переменных

### 🎨 Цвета

#### Фоновые цвета
- `--color-bg-primary` - основной фон (#0b1220)
- `--color-bg-secondary` - вторичный фон (#1f2a37)
- `--color-bg-tertiary` - третичный фон (#2c3e50)
- `--color-surface-1` до `--color-surface-5` - поверхности элементов

#### Цвета границ
- `--color-border-default` - стандартная граница
- `--color-border-light` - светлая граница
- `--color-border-subtle` - едва заметная граница (прозрачная)

#### Цветовые схемы
- **Primary (синий)**: `--color-primary`, `--color-primary-dark`, `--color-primary-light`
- **Success (зеленый)**: `--color-success`, `--color-success-dark`, `--color-success-accent`
- **Danger (красный)**: `--color-danger`, `--color-danger-hover`, `--color-danger-light`
- **Warning (желтый)**: `--color-warning`

#### Текстовые цвета
- `--color-text-primary` - основной текст
- `--color-text-bright` - яркий текст
- `--color-text-muted` - приглушенный текст
- `--color-text-subtle` - едва заметный текст

### 📏 Размеры

#### Border Radius
- `--radius-xs` (4px) до `--radius-3xl` (18px)
- `--radius-full` (999px) - полностью скругленные края

#### Spacing (отступы)
- `--spacing-1` (2px) до `--spacing-16` (32px)

#### Размеры шрифтов
- `--font-size-xs` (10px) до `--font-size-5xl` (24px)
- `--font-size-base` (12px) - базовый размер

#### Font Weights
- `--font-weight-normal` (400) до `--font-weight-black` (900)

#### Компоненты (фиксированные размеры)
- Кнопки: `--height-button-sm`, `--height-button-md`
- Сайдбары: `--width-sidebar-min`, `--width-sidebar`, `--width-sidebar-max`
- Иконки: `--width-icon`, `--height-icon`

### ⚡ Transitions
- `--transition-fast` (0.08s) - быстрая анимация
- `--transition-normal` (0.12s) - обычная анимация
- `--transition-smooth` (0.15s) - плавная анимация
- `--transition-slow` (0.2s) - медленная анимация

### 🎭 Opacity (прозрачность)
- `--opacity-disabled` (0.5) - отключенные элементы
- `--opacity-muted` (0.6) - приглушенные элементы
- `--opacity-medium` (0.75) - средняя прозрачность

### 📦 Z-index
- `--z-index-base` (1)
- `--z-index-sidebar` (5)
- `--z-index-overlay` (10)
- `--z-index-modal` (50)
- `--z-index-header` (1000)

### 💫 Shadows
- `--shadow-sm` - маленькая тень
- `--shadow-md` - средняя тень
- `--shadow-lg` - большая тень
- `--shadow-modal` - тень модального окна
- `--shadow-focus` - тень фокуса

### 🎨 Градиенты
- `--gradient-login-bg` - фон страницы входа
- `--gradient-button-primary` - градиент primary кнопки

## Лучшие практики

### ✅ Делайте так:

```css
/* Используйте переменные для всех цветов и размеров */
.component {
  background: var(--color-bg-primary);
  padding: var(--spacing-6);
  border-radius: var(--radius-md);
}

/* Группируйте связанные свойства */
.button {
  background: var(--color-primary);
  color: var(--color-text-white);
  border-radius: var(--radius-sm);
  transition: var(--transition-smooth);
}
```

### ❌ Не делайте так:

```css
/* Не используйте hardcoded значения */
.component {
  background: #0b1220; /* ❌ Используйте var(--color-bg-primary) */
  padding: 12px; /* ❌ Используйте var(--spacing-6) */
  border-radius: 8px; /* ❌ Используйте var(--radius-md) */
}
```

## Миграция существующего кода

1. Найдите все hardcoded цвета в вашем CSS
2. Замените их на соответствующие переменные
3. Проверьте, что визуально ничего не изменилось

Пример миграции:

```css
/* До */
.header {
  background-color: #2c3e50;
  color: white;
  padding: 12px;
}

/* После */
.header {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-white);
  padding: var(--spacing-6);
}
```

## Расширение системы

Если вам нужно добавить новые переменные:

1. Откройте `variables.css`
2. Добавьте новую переменную в соответствующую категорию
3. Используйте консистентное именование
4. Обновите эту документацию

### Соглашение об именовании

- Цвета: `--color-{категория}-{вариант}`
- Размеры: `--{тип}-{размер}`
- Spacing: `--spacing-{число}`
- Анимации: `--transition-{скорость}`

Примеры:
- `--color-primary-dark`
- `--radius-xl`
- `--spacing-12`
- `--transition-fast`
