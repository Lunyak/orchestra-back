# 📦 Система CSS переменных Orchestra

### 📁 Структура файлов

```
app/src/shared/styles/
├── variables.css          # Все CSS переменные (основной файл)
├── index.css             # Точка входа для импорта
├── README.md             # Полная документация
├── CHEATSHEET.md         # Быстрая шпаргалка
├── IMPLEMENTATION.md     # Руководство по внедрению
├── migration-example.css # Примеры миграции
└── SUMMARY.md            # Этот файл
```

## 📊 Статистика

### Цвета (80+ переменных):
- 🎨 **Фоновые**: 12 основных + 8 поверхностей
- 🔷 **Границы**: 9 вариантов
- 🔵 **Primary (синие)**: 11 оттенков
- 🟢 **Success (зеленые)**: 3 оттенка
- 🔴 **Danger (красные)**: 8 оттенков
- 🟡 **Warning (желтые)**: 2 оттенка
- ⚪ **Текстовые**: 15 вариантов
- 🌫️ **Прозрачные фоны**: 8 вариантов
- 🌑 **Тени**: 11 вариантов
- 🎨 **Градиенты**: 3 готовых градиента

### Размеры (70+ переменных):
- 🔘 **Border Radius**: 8 размеров (4px → 999px)
- 📏 **Spacing**: 11 размеров (2px → 32px)
- 📝 **Font Size**: 10 размеров (10px → 24px)
- ⚖️ **Font Weight**: 6 вариантов (400 → 900)
- 📐 **Line Height**: 4 варианта
- 📦 **Фиксированные размеры**: 20+ для компонентов
- 🔢 **Z-index**: 6 слоев
- ⏱️ **Transitions**: 8 готовых анимаций
- 👁️ **Opacity**: 7 уровней прозрачности
- 💫 **Shadows**: 7 готовых теней

## 🎯 Ключевые возможности

### 1. Полная цветовая палитра
```css
/* Все цвета из вашего проекта собраны в одном месте */
--color-bg-primary: #0b1220;
--color-primary: #2563eb;
--color-success: #10b981;
--color-danger: #b91c1c;
```

### 2. Консистентные размеры
```css
/* Стандартизированные отступы и размеры */
--spacing-6: 12px;    /* Стандартный padding */
--radius-sm: 6px;     /* Кнопки */
--radius-xl: 12px;    /* Карточки */
```

### 3. Готовые анимации
```css
/* Переиспользуемые transitions */
--transition-normal: 0.12s ease;
--transition-all-smooth: border-color 0.15s ease, box-shadow 0.15s ease;
```

### 4. Семантические имена
```css
/* Понятные названия вместо hex-кодов */
var(--color-primary)      /* вместо #2563eb */
var(--color-text-muted)   /* вместо #94a3b8 */
var(--spacing-6)          /* вместо 12px */
```

## 🚀 Быстрый старт

### 1. Переменные уже подключены!
Файл `app/src/index.css` уже обновлен и импортирует переменные:
```css
@import './shared/styles/index.css';
```

### 2. Начните использовать прямо сейчас
```css
/* Создайте или откройте любой CSS файл */
.my-component {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  padding: var(--spacing-6);
  border-radius: var(--radius-md);
  transition: var(--transition-smooth);
}
```

### 3. Используйте шпаргалку
Откройте `CHEATSHEET.md` для быстрого поиска нужных переменных.

## 📚 Документация

### Для начинающих:
1. **CHEATSHEET.md** - быстрая справка, все переменные в одном месте
2. **migration-example.css** - примеры "до" и "после"

### Для продвинутых:
1. **README.md** - полная документация со всеми деталями
2. **IMPLEMENTATION.md** - план и процесс миграции
3. **variables.css** - исходный код всех переменных

## 🎨 Примеры использования

### Кнопка
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
  color: var(--color-text-primary);
}
```

### Инпут с фокусом
```css
.input {
  background: var(--color-surface-2);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  padding: var(--spacing-2) var(--spacing-3);
  color: var(--color-text-primary);
  transition: var(--transition-all-smooth);
}

.input:focus {
  border-color: var(--color-primary-light);
  box-shadow: var(--shadow-focus);
}
```