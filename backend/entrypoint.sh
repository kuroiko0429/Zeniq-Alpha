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
exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload

