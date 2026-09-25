"""商品管理APIのテスト。"""


def test_create_and_list_products(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    res = client.post("/api/products", json={"name": "焼きそば", "price": 500, "stock": 100}, headers=headers)
    assert res.status_code == 200
    assert res.json()["store_product_no"] == 1

    list_res = client.get("/api/products", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1


def test_store_product_no_increments_sequentially(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    for i in range(3):
        res = client.post("/api/products", json={"name": f"商品{i}", "price": 100, "stock": 10}, headers=headers)
        assert res.status_code == 200

    numbers = [p["store_product_no"] for p in client.get("/api/products", headers=headers).json()]
    assert sorted(numbers) == [1, 2, 3]


def test_create_product_negative_price_rejected(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    res = client.post("/api/products", json={"name": "不正", "price": -100, "stock": 10}, headers=headers)
    assert res.status_code == 422


def test_create_product_negative_stock_rejected(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    res = client.post("/api/products", json={"name": "不正", "price": 100, "stock": -1}, headers=headers)
    assert res.status_code == 422


def test_products_scoped_per_store(client, normal_store, other_store, auth_header):
    yaki_headers = auth_header(client, "yakisoba", "pass12345")
    kara_headers = auth_header(client, "karaage", "pass12345")
    client.post("/api/products", json={"name": "焼きそば", "price": 500, "stock": 100}, headers=yaki_headers)

    assert client.get("/api/products", headers=kara_headers).json() == []


def test_update_product(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    client.post("/api/products", json={"name": "焼きそば", "price": 500, "stock": 100}, headers=headers)

    res = client.put(
        "/api/products/1",
        json={"name": "焼きそば(大盛)", "price": 700, "stock": 90},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["price"] == 700
    assert res.json()["name"] == "焼きそば(大盛)"


def test_update_nonexistent_product_returns_404(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    res = client.put(
        "/api/products/999",
        json={"name": "存在しない", "price": 100, "stock": 1},
        headers=headers,
    )
    assert res.status_code == 404


def test_delete_product_without_orders(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    client.post("/api/products", json={"name": "焼きそば", "price": 500, "stock": 100}, headers=headers)

    res = client.delete("/api/products/1", headers=headers)
    assert res.status_code == 200
    assert client.get("/api/products", headers=headers).json() == []


def test_delete_product_with_order_history_blocked(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    client.post("/api/products", json={"name": "焼きそば", "price": 500, "stock": 100}, headers=headers)
    client.post(
        "/api/orders",
        json={
            "items": [{"store_product_no": 1, "quantity": 1}],
            "total": 500,
            "payment_method": [{"cash": 500}],
        },
        headers=headers,
    )

    res = client.delete("/api/products/1", headers=headers)
    assert res.status_code == 400
    # 削除されずに残っていること
    assert len(client.get("/api/products", headers=headers).json()) == 1
