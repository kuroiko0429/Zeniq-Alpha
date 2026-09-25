"""売上集計APIのテスト。"""
import datetime


def _create_product(client, headers, name="焼きそば", price=500, stock=100):
    res = client.post("/api/products", json={"name": name, "price": price, "stock": stock}, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


def _create_order(client, headers, store_product_no, quantity, unit_price, payment_method):
    total = unit_price * quantity
    res = client.post(
        "/api/orders",
        json={
            "items": [{"store_product_no": store_product_no, "quantity": quantity}],
            "total": total,
            "payment_method": [payment_method],
        },
        headers=headers,
    )
    assert res.status_code == 200, res.text
    return res.json()


def test_sales_summary_totals_and_breakdown(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    _create_product(client, headers, name="焼きそば", price=500)
    _create_product(client, headers, name="から揚げ", price=300)

    _create_order(client, headers, 1, 2, 500, {"cash": 1000})
    _create_order(client, headers, 2, 1, 300, {"emoney": 300})

    res = client.get("/api/sales/summary", headers=headers)
    assert res.status_code == 200
    body = res.json()

    assert body["total_revenue"] == 1300
    assert body["total_orders"] == 2
    assert body["payment_breakdown"]["cash"] == 1000
    assert body["payment_breakdown"]["emoney"] == 300

    by_product = {p["product_name"]: p for p in body["sales_by_product"]}
    assert by_product["焼きそば"]["amount"] == 1000
    assert by_product["焼きそば"]["quantity"] == 2
    assert by_product["から揚げ"]["amount"] == 300


def test_sales_by_product_uses_historical_unit_price_not_current_price(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    _create_product(client, headers, price=500)
    _create_order(client, headers, 1, 1, 500, {"cash": 500})

    # 価格変更後も、売上集計は購入時点の単価（500円）を使うべき（現在価格の900円ではない）
    client.put("/api/products/1", json={"name": "焼きそば", "price": 900, "stock": 99}, headers=headers)

    res = client.get("/api/sales/summary", headers=headers)
    body = res.json()
    assert body["sales_by_product"][0]["amount"] == 500


def test_sales_summary_scoped_per_store(client, normal_store, other_store, auth_header):
    yaki_headers = auth_header(client, "yakisoba", "pass12345")
    kara_headers = auth_header(client, "karaage", "pass12345")
    _create_product(client, yaki_headers)
    _create_order(client, yaki_headers, 1, 1, 500, {"cash": 500})

    kara_summary = client.get("/api/sales/summary", headers=kara_headers).json()
    assert kara_summary["total_revenue"] == 0
    assert kara_summary["total_orders"] == 0
    assert kara_summary["sales_by_product"] == []


def test_sales_summary_date_filter(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    _create_product(client, headers)
    _create_order(client, headers, 1, 1, 500, {"cash": 500})

    today = datetime.date.today().isoformat()
    res_today = client.get(f"/api/sales/summary?date={today}", headers=headers)
    assert res_today.status_code == 200
    assert res_today.json()["total_orders"] == 1

    res_other_day = client.get("/api/sales/summary?date=2000-01-01", headers=headers)
    assert res_other_day.json()["total_orders"] == 0


def test_sales_summary_invalid_date_rejected(client, normal_store, auth_header):
    headers = auth_header(client, "yakisoba", "pass12345")
    res = client.get("/api/sales/summary?date=not-a-date", headers=headers)
    assert res.status_code == 400
