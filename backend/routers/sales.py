from datetime import datetime, date as date_cls
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
import models
from auth.dependencies import get_current_store

router = APIRouter()


@router.get("/api/sales/summary")
def get_sales_summary(
    date: Optional[str] = Query(
        None,
        description="YYYY-MM-DD 形式。指定するとその日の会計のみに絞り込む（未指定なら全期間）。"
    ),
    db: Session = Depends(get_db),
    current_store = Depends(get_current_store)
):
    store_id = current_store["store_id"]

    # 「日別」タブ用に、対象日を1日分だけに絞り込めるようにする
    target_date: Optional[date_cls] = None
    if date is not None:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="date は YYYY-MM-DD 形式で指定してください")

    order_filters = [models.Order.store_id == store_id]
    if target_date is not None:
        order_filters.append(func.date(models.Order.created_at) == target_date)

    orders = db.query(models.Order).filter(*order_filters).all()

    total_revenue = sum(order.total for order in orders)
    total_orders = len(orders)

    # 商品別売上（従来通り）
    sales_by_product = db.query(
        models.Product.name,
        func.sum(models.OrderItem.quantity).label("total_quantity"),
        func.sum(models.Product.price * models.OrderItem.quantity).label("total_amount")
    ).join(
        models.OrderItem, models.Product.id == models.OrderItem.product_id
    ).join(
        models.Order, models.OrderItem.order_id == models.Order.id
    ).filter(
        *order_filters
    ).group_by(models.Product.name).all()

    # 決済手段別の内訳（現金・模擬券・電子マネー）
    payment_totals = db.query(
        func.coalesce(func.sum(models.OrderPaymentMethod.cash), 0),
        func.coalesce(func.sum(models.OrderPaymentMethod.ticket_100), 0),
        func.coalesce(func.sum(models.OrderPaymentMethod.ticket_200), 0),
        func.coalesce(func.sum(models.OrderPaymentMethod.emoney), 0),
    ).join(
        models.Order, models.OrderPaymentMethod.order_id == models.Order.id
    ).filter(
        *order_filters
    ).first()

    cash_total, ticket_100_count, ticket_200_count, emoney_total = payment_totals
    ticket_amount_total = ticket_100_count * 100 + ticket_200_count * 200

    # 日別集計（全期間タブから日を選ぶ・推移を見る用途を想定。store全体の日付一覧なので date 指定時も無視して出す）
    sales_by_day = db.query(
        func.date(models.Order.created_at).label("day"),
        func.count(models.Order.id).label("order_count"),
        func.coalesce(func.sum(models.Order.total), 0).label("revenue")
    ).filter(
        models.Order.store_id == store_id
    ).group_by(
        func.date(models.Order.created_at)
    ).order_by(
        func.date(models.Order.created_at).desc()
    ).all()

    return {
        "total_revenue": total_revenue,
        "total_orders": total_orders,
        "sales_by_product": [
            {
                "product_name": row[0],
                "quantity": row[1],
                "amount": row[2]
            }
            for row in sales_by_product
        ],
        "payment_breakdown": {
            "cash": cash_total,
            "ticket_100_count": ticket_100_count,
            "ticket_200_count": ticket_200_count,
            "ticket_amount": ticket_amount_total,
            "emoney": emoney_total,
        },
        "sales_by_day": [
            {
                "date": row.day.isoformat() if hasattr(row.day, "isoformat") else str(row.day),
                "total_orders": row.order_count,
                "total_revenue": row.revenue,
            }
            for row in sales_by_day
        ],
    }