# main.py
import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import IntegrityError

from database import engine
import models
from routers import products, orders, sales, auth
from rate_limit import limiter

logger = logging.getLogger("pos_api")

app = FastAPI(title="学校祭POS API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# DB制約違反（一意制約・外部キー制約など）はrouter/service側で個別に
# ハンドリングしきれていない場合、素の500としてスタックトレースが
# 漏れてしまっていた。ここで一律409に変換する安全網を用意する。
@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    logger.warning("Unhandled IntegrityError on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=409,
        content={"detail": "データの整合性エラーが発生しました。入力内容を確認してもう一度お試しください。"}
    )

# その他の想定外の例外も、スタックトレースをクライアントに漏らさず
# 統一フォーマットで返す（HTTPExceptionは個別ハンドラが優先されるため対象外）。
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "サーバー内部でエラーが発生しました。"}
    )

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