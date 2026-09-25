# main.py
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from database import engine
import models
from routers import products, orders, sales, auth
from rate_limit import limiter

app = FastAPI(title="学校祭POS API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 許可するフロントエンドのオリジン。CORS_ORIGINS環境変数（カンマ区切り）で上書き可能。
# 未設定時はDocker/Podman双方のローカル配信ポート（80・8080）を許可する。
_DEFAULT_CORS_ORIGINS = [
    "http://localhost",
    "http://localhost:80",
    "http://localhost:8080",
    "http://127.0.0.1",
    "http://127.0.0.1:80",
    "http://127.0.0.1:8080",
]
_cors_env = os.getenv("CORS_ORIGINS")
cors_origins = (
    [origin.strip() for origin in _cors_env.split(",") if origin.strip()]
    if _cors_env
    else _DEFAULT_CORS_ORIGINS
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(products.router)
app.include_router(orders.router)
app.include_router(sales.router)
app.include_router(auth.router)