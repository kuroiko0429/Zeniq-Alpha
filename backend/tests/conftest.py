# conftest.py
#
# backendのテストは、実際のPostgreSQLの代わりに独立したインメモリSQLiteを
# テストごとに作成して使う（本番のPostgreSQL固有機能には依存していないため）。
# main.py / auth.dependencies が起動時にSECRET_KEYを要求するので、
# アプリをimportする前に環境変数を設定しておく必要がある。
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from database import Base, get_db
import models  # noqa: F401  Base.metadata にモデルを登録するために必要
from main import app
from models.store import Store
from services.auth_service import hash_password
from rate_limit import limiter


@pytest.fixture()
def db_session():
    """テストごとに独立したインメモリSQLite DBを用意する。"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """POST /api/auth/login のレート制限（10/minute）がテスト間で
    共有されて意図せず429になるのを防ぐため、各テストの前にリセットする。"""
    limiter.reset()
    yield


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def admin_store(db_session):
    store = Store(
        name="運営本部",
        username="admin",
        hashed_password=hash_password("admin12345"),
        is_admin=True,
    )
    db_session.add(store)
    db_session.commit()
    db_session.refresh(store)
    return store


@pytest.fixture()
def normal_store(db_session):
    store = Store(
        name="焼きそば班",
        username="yakisoba",
        hashed_password=hash_password("pass12345"),
        is_admin=False,
    )
    db_session.add(store)
    db_session.commit()
    db_session.refresh(store)
    return store


@pytest.fixture()
def other_store(db_session):
    store = Store(
        name="から揚げ班",
        username="karaage",
        hashed_password=hash_password("pass12345"),
        is_admin=False,
    )
    db_session.add(store)
    db_session.commit()
    db_session.refresh(store)
    return store


@pytest.fixture()
def auth_header():
    """client.post('/api/auth/login', ...) してAuthorizationヘッダーを組み立てるヘルパー。"""
    def _login(client, username, password):
        res = client.post(
            "/api/auth/login",
            data={"username": username, "password": password},
        )
        assert res.status_code == 200, res.text
        return {"Authorization": f"Bearer {res.json()['access_token']}"}
    return _login
