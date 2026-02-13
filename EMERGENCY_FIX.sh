#!/bin/bash
echo "🚨 ЭКСТРЕННОЕ ИСПРАВЛЕНИЕ МИГРАЦИЙ"
echo ""
echo "На production сервере выполните:"
echo ""
echo "# 1. Удалите ВСЕ failed миграции"
echo 'docker exec -it orkestr-postgres psql -U postgres -d dophamin_orkestr -c "DELETE FROM _prisma_migrations WHERE finished_at IS NULL;"'
echo ""
echo "# 2. Или удалите конкретную миграцию"
echo 'docker exec -it orkestr-postgres psql -U postgres -d dophamin_orkestr -c "DELETE FROM _prisma_migrations WHERE migration_name = '"'"'20260213091146_add_user_profile_fields'"'"';"'
echo ""
echo "# 3. Перезапустите"
echo "docker-compose restart back"
echo ""
echo "# 4. Проверьте логи"
echo "docker logs orkestr-back --tail=50 -f"
