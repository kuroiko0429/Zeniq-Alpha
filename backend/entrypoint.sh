#!/bin/bash
set -e

echo "Waiting for PostgreSQL..."
while ! pg_isready -h $DB_HOST -U $DB_USER 2>/dev/null; do
  sleep 1
done

echo "Running database migrations..."
cd /app
alembic upgrade head || echo "Warning: Migration failed, but continuing..."

echo "Starting FastAPI application..."
# 本番相当（ENVIRONMENT=production）では--reloadを無効にする。
# --reloadはwatchfilesによる常時ファイル監視が入り、アイドル時でも
# CPUを食う（実測: PODMAN_NOTES.md参照）ため、開発時のみ有効にする。
if [ "$ENVIRONMENT" = "production" ]; then
  exec uvicorn main:app --host 0.0.0.0 --port 8000
else
  exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload
fi

