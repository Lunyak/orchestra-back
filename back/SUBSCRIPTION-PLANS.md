# Тарифы подписки

При старте бэкенда автоматически создаются два тарифа:

| Тариф     | maxProjects | maxCollaboratorsPerProject |
|-----------|-------------|----------------------------|
| **free**  | 3           | 0                          |
| **standard** | 10       | 5                          |

## Как подключить тариф «standard» к своему пользователю

### Вариант 1: по email (PostgreSQL)

```sql
UPDATE "User"
SET "subscriptionId" = (SELECT id FROM "SubscriptionPlan" WHERE name = 'standard')
WHERE email = 'ваш@email.com';
```

### Вариант 2: по id пользователя

Узнайте id пользователя и id тарифа:

```sql
SELECT id, email FROM "User";
SELECT id, name, "maxProjects" FROM "SubscriptionPlan";
```

Затем:

```sql
UPDATE "User"
SET "subscriptionId" = 'ID_ТАРИФА_STANDARD'
WHERE id = 'ID_ВАШЕГО_ПОЛЬЗОВАТЕЛЯ';
```

### Вариант 3: через Prisma Studio

1. Запустите: `npx prisma studio`
2. Откройте таблицу **User**, найдите свою запись
3. В поле **subscriptionId** выберите id тарифа **standard** (из таблицы SubscriptionPlan)
4. Сохраните

После смены тарифа пользователь может создавать до 10 проектов (вместо 3).
