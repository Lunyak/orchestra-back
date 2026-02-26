.PHONY: help dev prod stop deploy logs status clean https-up https-down https-rebuild

# Цвета для вывода
GREEN  := \033[0;32m
YELLOW := \033[0;33m
RED    := \033[0;31m
NC     := \033[0m # No Color

help: ## Показать эту справку
	@echo "$(GREEN)Orchestra Services - Управление контейнерами$(NC)"
	@echo ""
	@echo "$(YELLOW)Доступные команды:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'

dev: ## Запустить dev-окружение с hot-reload
	@./scripts/dev.sh

prod: ## Запустить production окружение
	@./scripts/prod.sh

stop: ## Остановить все контейнеры
	@./scripts/stop.sh

deploy: ## Деплой на production сервер
	@./scripts/deploy.sh

logs: ## Показать логи всех контейнеров
	@docker compose logs -f

logs-back: ## Показать логи бэкенда
	@docker compose logs -f back

logs-web: ## Показать логи фронтенда
	@docker compose logs -f web

status: ## Показать статус контейнеров
	@echo "$(YELLOW)Статус контейнеров:$(NC)"
	@docker compose ps

restart: ## Перезапустить все контейнеры (production)
	@echo "$(YELLOW)Перезапуск контейнеров...$(NC)"
	@docker compose restart
	@echo "$(GREEN)✅ Контейнеры перезапущены$(NC)"

restart-back: ## Перезапустить только бэкенд
	@docker compose restart back

rebuild: ## Пересобрать и перезапустить (production)
	@echo "$(YELLOW)Пересборка контейнеров...$(NC)"
	@docker compose up -d --build
	@echo "$(GREEN)✅ Контейнеры пересобраны и запущены$(NC)"

https-up: ## Запустить production с HTTPS (Caddy + Let's Encrypt)
	@echo "$(YELLOW)Запуск production с HTTPS...$(NC)"
	@docker compose -f docker-compose.yml -f docker-compose.https.yml up -d
	@echo "$(GREEN)✅ HTTPS-окружение запущено$(NC)"

https-rebuild: ## Пересобрать и запустить production с HTTPS
	@echo "$(YELLOW)Пересборка HTTPS-окружения...$(NC)"
	@docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
	@echo "$(GREEN)✅ HTTPS-окружение пересобрано и запущено$(NC)"

https-down: ## Остановить production с HTTPS и убрать orphan-контейнеры
	@echo "$(YELLOW)Остановка HTTPS-окружения...$(NC)"
	@docker compose -f docker-compose.yml -f docker-compose.https.yml down --remove-orphans
	@echo "$(GREEN)✅ HTTPS-окружение остановлено$(NC)"

clean: ## Остановить и удалить все контейнеры и volumes (ОСТОРОЖНО!)
	@echo "$(RED)⚠️  Это удалит ВСЕ данные, включая БД!$(NC)"
	@read -p "Вы уверены? [y/N]: " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker compose down -v; \
		docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v; \
		echo "$(GREEN)✅ Очистка завершена$(NC)"; \
	fi

backup-db: ## Создать бэкап базы данных
	@echo "$(YELLOW)Создание бэкапа БД...$(NC)"
	@mkdir -p ./backups
	@docker compose exec postgres pg_dump -U orkestr -d dophamin_orkestr --no-owner --no-acl -F c -f /tmp/backup_$$(date +%Y%m%d_%H%M%S).dump
	@docker compose cp postgres:/tmp/backup_*.dump ./backups/
	@echo "$(GREEN)✅ Бэкап создан в ./backups/$(NC)"

shell-back: ## Открыть shell в контейнере бэкенда
	@docker compose exec back sh

shell-postgres: ## Открыть psql в контейнере postgres
	@docker compose exec postgres psql -U orkestr -d dophamin_orkestr

ps: ## Показать все запущенные контейнеры проекта
	@docker ps --filter "name=orkestr-"
