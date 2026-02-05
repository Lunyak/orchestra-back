# Хранилище файлов (аудио, изображения)

Бэкенд поддерживает два режима: **MinIO/S3** и **локальный диск** (`STORAGE_TYPE=local`).

## MinIO с постоянными ссылками (без срока действия)

В интерфейсе MinIO убрали кнопку публичного доступа, но всё настраивается через **MinIO Client (mc)**.

### 1. Установить mc и добавить хост

```bash
# macOS (Homebrew)
brew install minio/stable/mc

# Добавить хост (подставь свой endpoint и ключи)
mc alias set myminio http://localhost:9000 ACCESS_KEY SECRET_KEY
```

### 2. Открыть бакет на публичное чтение

```bash
# Имя бакета — как в S3_BUCKET (по умолчанию orchestra-media)
mc anonymous set download myminio/orchestra-media
```

Либо политика через JSON (если нужен только GetObject):

```bash
cat > /tmp/bucket-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::orchestra-media/*"]
    }
  ]
}
EOF
mc admin policy create myminio read-only /tmp/bucket-policy.json
# или через anonymous:
mc anonymous set download myminio/orchestra-media
```

### 3. Переменные бэкенда (по желанию)

В `.env` нужны только стандартные `S3_ENDPOINT`, `S3_BUCKET`, ключи и т.д.  
Если MinIO доступен с браузера по **другому** адресу (например, через nginx), укажи его:

```env
# Только если MinIO снаружи по другому URL
MINIO_PUBLIC_URL=https://minio.example.com
```

Иначе используется `S3_ENDPOINT`.  
После настройки бакета через mc при загрузке возвращаются постоянные ссылки — **без срока действия**.

## Локальное хранилище (без MinIO)

В `.env`:

```env
STORAGE_TYPE=local
STORAGE_PATH=./uploads
APP_PUBLIC_URL=http://localhost:3000
```

Файлы сохраняются на диск, раздаются по маршруту `/files/play/:key` — ссылки постоянные.
