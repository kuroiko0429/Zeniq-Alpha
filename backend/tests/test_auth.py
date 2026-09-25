"""認証・店舗登録まわりのテスト。"""


def test_login_success_returns_token_and_is_admin(client, admin_store):
    res = client.post("/api/auth/login", data={"username": "admin", "password": "admin12345"})
    assert res.status_code == 200
    body = res.json()
    assert body["access_token"]
    assert body["store_name"] == "運営本部"
    assert body["is_admin"] is True


def test_login_wrong_password_returns_401(client, normal_store):
    res = client.post("/api/auth/login", data={"username": "yakisoba", "password": "wrongpass"})
    assert res.status_code == 401


def test_login_unknown_username_returns_401(client):
    res = client.post("/api/auth/login", data={"username": "nobody", "password": "whatever"})
    assert res.status_code == 401


def test_register_requires_admin(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    res = client.post(
        "/api/auth/register",
        json={"name": "たこ焼き部", "username": "takoyaki", "password": "pass12345"},
        headers=headers,
    )
    assert res.status_code == 403


def test_register_success_as_admin_and_new_account_can_login(client, admin_store, auth_header):
    headers = auth_header(client, "admin", "admin12345")
    res = client.post(
        "/api/auth/register",
        json={"name": "たこ焼き部", "username": "takoyaki", "password": "pass12345"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["username"] == "takoyaki"

    login_res = client.post("/api/auth/login", data={"username": "takoyaki", "password": "pass12345"})
    assert login_res.status_code == 200
    assert login_res.json()["is_admin"] is False


def test_register_duplicate_username_rejected(client, admin_store, normal_store, auth_header):
    headers = auth_header(client, "admin", "admin12345")
    res = client.post(
        "/api/auth/register",
        json={"name": "別の店", "username": "yakisoba", "password": "pass12345"},
        headers=headers,
    )
    assert res.status_code == 400


def test_register_password_too_short_rejected(client, admin_store, auth_header):
    headers = auth_header(client, "admin", "admin12345")
    res = client.post(
        "/api/auth/register",
        json={"name": "たこ焼き部", "username": "takoyaki", "password": "short"},
        headers=headers,
    )
    assert res.status_code == 422


def test_login_without_token_cannot_register(client):
    res = client.post(
        "/api/auth/register",
        json={"name": "たこ焼き部", "username": "takoyaki", "password": "pass12345"},
    )
    assert res.status_code == 401


def test_login_rate_limited_after_ten_attempts(client, normal_store):
    for _ in range(10):
        res = client.post("/api/auth/login", data={"username": "yakisoba", "password": "wrong"})
        assert res.status_code == 401

    res = client.post("/api/auth/login", data={"username": "yakisoba", "password": "wrong"})
    assert res.status_code == 429
