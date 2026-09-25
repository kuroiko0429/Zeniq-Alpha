"""注文APIのテスト。"""


def _create_product(client, headers, name="焼きそば", price=500, stock=100):
    res = client.post("/api/products", json={"name": name, "price": price, "stock": stock}, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


def test_create_order_success_with_unit_price_snapshot(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    _create_product(client, headers)

    res = client.post(
        "/api/orders",
        json={
            "items": [{"store_product_no": 1, "quantity": 2}],
            "total": 1000,
            "payment_method": [{"cash": 1000}],
        },
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1000
    assert body["tendered"] == 1000
    assert body["change"] == 0
    assert body["items"][0]["unit_price"] == 500
    assert body["items"][0]["quantity"] == 2

    # 在庫が減っていること
    product = client.get("/api/products/1", headers=headers).json()
    assert product["stock"] == 98


def test_create_order_insufficient_stock_rejected(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    _create_product(client, headers, stock=1)

    res = client.post(
        "/api/orders",
        json={
            "items": [{"store_product_no": 1, "quantity": 2}],
            "total": 1000,
            "payment_method": [{"cash": 1000}],
        },
        headers=headers,
    )
    assert res.status_code == 400


def test_create_order_wrong_total_rejected(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    _create_product(client, headers)

    res = client.post(
        "/api/orders",
        json={
            "items": [{"store_product_no": 1, "quantity": 1}],
            "total": 9999,
            "payment_method": [{"cash": 9999}],
        },
        headers=headers,
    )
    assert res.status_code == 400


def test_create_order_insufficient_payment_rejected(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    _create_product(client, headers)

    res = client.post(
        "/api/orders",
        json={
            "items": [{"store_product_no": 1, "quantity": 1}],
            "total": 500,
            "payment_method": [{"cash": 100}],
        },
        headers=headers,
    )
    assert res.status_code == 400


def test_create_order_zero_quantity_rejected(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    _create_product(client, headers)

    res = client.post(
        "/api/orders",
        json={
            "items": [{"store_product_no": 1, "quantity": 0}],
            "total": 0,
            "payment_method": [{"cash": 0}],
        },
        headers=headers,
    )
    assert res.status_code == 422


def test_order_unit_price_unaffected_by_later_price_change(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    _create_product(client, headers, price=500)

    client.post(
        "/api/orders",
        json={
            "items": [{"store_product_no": 1, "quantity": 1}],
            "total": 500,
            "payment_method": [{"cash": 500}],
        },
        headers=headers,
    )

    # 商品価格を後から変更する
    client.put("/api/products/1", json={"name": "焼きそば", "price": 800, "stock": 99}, headers=headers)

    fetched = client.get("/api/orders", headers=headers).json()
    assert fetched[0]["items"][0]["unit_price"] == 500
    assert fetched[0]["total"] == 500


def test_orders_pagination(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    _create_product(client, headers)
    for _ in range(3):
        client.post(
            "/api/orders",
            json={
                "items": [{"store_product_no": 1, "quantity": 1}],
                "total": 500,
                "payment_method": [{"cash": 500}],
            },
            headers=headers,
        )

    all_orders = client.get("/api/orders", headers=headers).json()
    assert len(all_orders) == 3

    first_page = client.get("/api/orders?limit=2&offset=0", headers=headers).json()
    second_page = client.get("/api/orders?limit=2&offset=2", headers=headers).json()
    assert len(first_page) == 2
    assert len(second_page) == 1
    combined_ids = {o["id"] for o in first_page} | {o["id"] for o in second_page}
    assert combined_ids == {o["id"] for o in all_orders}


def test_orders_scoped_per_store(client, normal_store, other_store, auth_header):
    yaki_headers = auth_header(client, "yakisoba", "pass12345")
    kara_headers = auth_header(client, "karaage", "pass12345")
    _create_product(client, yaki_headers)
    client.post(
        "/api/orders",
        json={
            "items": [{"store_product_no": 1, "quantity": 1}],
            "total": 500,
            "payment_method": [{"cash": 500}],
        },
        headers=yaki_headers,
    )

    assert client.get("/api/orders", headers=kara_headers).json() == []


def test_delete_order_restores_stock(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    _create_product(client, headers, stock=10)
    order = client.post(
        "/api/orders",
        json={
            "items": [{"store_product_no": 1, "quantity": 3}],
            "total": 1500,
            "payment_method": [{"cash": 1500}],
        },
        headers=headers,
    ).json()

    assert client.get("/api/products/1", headers=headers).json()["stock"] == 7

    res = client.delete(f"/api/orders/{order['id']}", headers=headers)
    assert res.status_code == 200
    assert client.get("/api/products/1", headers=headers).json()["stock"] == 10
