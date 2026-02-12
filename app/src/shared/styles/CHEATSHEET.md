# 🎨 CSS Переменные - Шпаргалка

Быстрая справка по всем доступным CSS переменным проекта Orchestra.

## 🎨 Цвета

### Фоны

```css
var(--color-bg-primary)        /* #0b1220 - главный фон */
var(--color-bg-secondary)      /* #1f2a37 - сайдбары */
var(--color-bg-tertiary)       /* #2c3e50 - хедер */
var(--color-bg-dark)           /* #020617 - темный фон */

var(--color-surface-1)         /* #0f172a - элементы */
var(--color-surface-2)         /* #1f2937 - кнопки, инпуты */
var(--color-surface-3)         /* #111827 - карточки */
```

### Границы

```css
var(--color-border-default)    /* #1f2937 */
var(--color-border-light)      /* #374151 */
var(--color-border-subtle)     /* rgba(255, 255, 255, 0.08) */
var(--color-border-medium)     /* rgba(255, 255, 255, 0.10) */
var(--color-border-visible)    /* rgba(255, 255, 255, 0.12) */
```

### Кнопки и действия

```css
/* Primary (синий) */
var(--color-primary)           /* #2563eb */
var(--color-primary-dark)      /* #1d4ed8 - hover */
var(--color-primary-light)     /* #3b82f6 - focus */

/* Success (зеленый) */
var(--color-success)           /* #10b981 */
var(--color-success-accent)    /* #22c55e */

/* Danger (красный) */
var(--color-danger)            /* #b91c1c */
var(--color-danger-hover)      /* #dc2626 */
var(--color-danger-light)      /* #f87171 */

/* Warning (желтый) */
var(--color-warning)           /* #fbbf24 */
```

### Текст

```css
var(--color-text-primary)      /* #e2e8f0 - основной */
var(--color-text-bright)       /* #f8fafc - заголовки */
var(--color-text-white)        /* #ffffff */
var(--color-text-muted)        /* #94a3b8 - вторичный */
var(--color-text-subtle)       /* #9ca3af - едва заметный */
var(--color-text-placeholder)  /* #6b7280 */
```

### Прозрачные фоны

```css
var(--color-bg-transparent-1)  /* rgba(255, 255, 255, 0.03) */
var(--color-bg-transparent-2)  /* rgba(255, 255, 255, 0.04) */
var(--color-bg-transparent-3)  /* rgba(255, 255, 255, 0.05) */
var(--color-bg-hover)          /* rgba(255, 255, 255, 0.1) */
var(--color-bg-active)         /* rgba(255, 255, 255, 0.2) */
```

## 📏 Размеры

### Border Radius

```css
var(--radius-xs)    /* 4px */
var(--radius-sm)    /* 6px - кнопки, инпуты */
var(--radius-md)    /* 8px */
var(--radius-lg)    /* 10px */
var(--radius-xl)    /* 12px - карточки */
var(--radius-2xl)   /* 14px - модалки */
var(--radius-3xl)   /* 18px */
var(--radius-full)  /* 999px - круглые */
```

### Spacing (отступы)

```css
var(--spacing-1)    /* 2px */
var(--spacing-2)    /* 4px */
var(--spacing-3)    /* 6px - padding кнопок */
var(--spacing-4)    /* 8px */
var(--spacing-5)    /* 10px */
var(--spacing-6)    /* 12px - стандартный padding */
var(--spacing-8)    /* 16px */
var(--spacing-10)   /* 20px */
var(--spacing-12)   /* 24px */
var(--spacing-16)   /* 32px */
```

### Размеры шрифтов

```css
var(--font-size-xs)    /* 10px */
var(--font-size-sm)    /* 11px - мелкий текст */
var(--font-size-base)  /* 12px - основной */
var(--font-size-md)    /* 13px */
var(--font-size-lg)    /* 14px */
var(--font-size-xl)    /* 16px */
var(--font-size-2xl)   /* 18px */
var(--font-size-3xl)   /* 20px - заголовки */
var(--font-size-4xl)   /* 22px */
var(--font-size-5xl)   /* 24px */
```

### Font Weights

```css
var(--font-weight-normal)     /* 400 */
var(--font-weight-medium)     /* 500 */
var(--font-weight-semibold)   /* 600 */
var(--font-weight-bold)       /* 700 */
var(--font-weight-extrabold)  /* 800 */
var(--font-weight-black)      /* 900 */
```

### Фиксированные размеры компонентов

```css
/* Кнопки */
var(--height-button-xs)    /* 22px */
var(--height-button-sm)    /* 34px */
var(--height-button-md)    /* 38px */

/* Сайдбары */
var(--width-sidebar-min)   /* 200px */
var(--width-sidebar)       /* 240px */
var(--width-sidebar-max)   /* 280px */
var(--width-panel)         /* 320px */

/* Иконки */
var(--width-icon)          /* 24px */
var(--height-icon)         /* 24px */
```

## ⚡ Анимации

### Transitions

```css
var(--transition-fast)         /* 0.08s ease */
var(--transition-normal)       /* 0.12s ease */
var(--transition-smooth)       /* 0.15s ease */
var(--transition-slow)         /* 0.2s ease */

/* Комплексные */
var(--transition-transform)    /* transform 0.08s ease */
var(--transition-colors)       /* background 0.12s ease, color 0.12s ease */
var(--transition-all-smooth)   /* border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease */
```

### Opacity

```css
var(--opacity-disabled)   /* 0.5 */
var(--opacity-muted)      /* 0.6 */
var(--opacity-subtle)     /* 0.7 */
var(--opacity-medium)     /* 0.75 */
var(--opacity-visible)    /* 0.8 */
var(--opacity-bright)     /* 0.85 */
```

## 💫 Тени

```css
var(--shadow-sm)       /* 0 2px 4px - маленькая */
var(--shadow-md)       /* 2px 0 8px - средняя */
var(--shadow-lg)       /* 0 10px 25px - большая */
var(--shadow-modal)    /* для модальных окон */
var(--shadow-focus)    /* 0 0 0 1px - фокус инпута */
var(--shadow-inset)    /* inset 0 0 6px - внутренняя */
```

## 📦 Z-index

```css
var(--z-index-base)      /* 1 */
var(--z-index-panel)     /* 2 */
var(--z-index-sidebar)   /* 5 */
var(--z-index-overlay)   /* 10 */
var(--z-index-modal)     /* 50 */
var(--z-index-header)    /* 1000 */
```

## 🎨 Градиенты

```css
var(--gradient-login-bg)         /* фон страницы входа */
var(--gradient-button-primary)   /* кнопка primary */
```

---

## 🔥 Популярные комбинации

### Стандартная кнопка

```css
.button {
  background: var(--color-primary);
  color: var(--color-text-white);
  padding: var(--spacing-3) var(--spacing-5);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-base);
  transition: var(--transition-normal);
}

.button:hover {
  background: var(--color-primary-dark);
}
```

### Карточка

```css
.card {
  background: var(--color-bg-transparent-2);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-xl);
  padding: var(--spacing-6);
}
```

### Инпут

```css
.input {
  background: var(--color-surface-2);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  padding: var(--spacing-2) var(--spacing-3);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  transition: var(--transition-all-smooth);
}

.input:focus {
  border-color: var(--color-primary-light);
  box-shadow: var(--shadow-focus);
}
```

### Сайдбар

```css
.sidebar {
  width: var(--width-sidebar);
  background: var(--color-bg-secondary);
  padding: var(--spacing-8);
  color: var(--color-text-white);
}
```

### Модальное окно

```css
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--color-shadow-dark);
  z-index: var(--z-index-modal);
}

.modal-content {
  background: var(--color-bg-modal);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-2xl);
  padding: var(--spacing-7);
}
```

### Состояния кнопок

```css
/* Success */
.button-success {
  background: var(--color-success);
  color: var(--color-bg-primary);
}

/* Danger */
.button-danger {
  background: var(--color-danger);
  color: var(--color-text-white);
}
.button-danger:hover {
  background: var(--color-danger-hover);
}

/* Disabled */
.button:disabled {
  opacity: var(--opacity-disabled);
  cursor: not-allowed;
}
```

---

## 💡 Советы

1. **Всегда используйте переменные** вместо hardcoded значений
2. **Группируйте свойства** логически (цвета вместе, размеры вместе)
3. **Используйте семантические имена** вместо значений (var(--color-primary) лучше чем #2563eb)
4. **Проверяйте dark/light режимы** если приложение их поддерживает
5. **Создавайте переиспользуемые классы** для частых комбинаций

## 🔍 Быстрый поиск

**Нужен синий цвет?** → `--color-primary`  
**Нужен зеленый?** → `--color-success`  
**Нужен красный?** → `--color-danger`  
**Стандартный отступ?** → `--spacing-6` (12px)  
**Скругление кнопки?** → `--radius-sm` (6px)  
**Скругление карточки?** → `--radius-xl` (12px)  
**Стандартный размер шрифта?** → `--font-size-base` (12px)  
**Анимация при hover?** → `--transition-normal` (0.12s)
