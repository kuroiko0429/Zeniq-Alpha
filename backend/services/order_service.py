from sqlalchemy.orm import Session
from fastapi import HTTPException
import models, schemas
 
def create(db: Session, order: schemas.OrderCreate, store_id: int):
    if not order.items:
        raise HTTPException(status_code=400, detail="商品が選択されていません")
 
    order_items = []
    calculated_total = 0
    for item in order.items:
        product = db.query(models.Product).filter(
            models.Product.store_product_no == item.store_product_no,
            models.Product.store_id == store_id
        ).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"商品番号 {item.store_product_no} が見つかりません")
        if product.stock < item.quantity:
            raise HTTPException(status_code=400, detail=f"{product.name} の在庫が不足しています（残り{product.stock}個）")
 
        subtotal = product.price * item.quantity
        calculated_total += subtotal
        product.stock -= item.quantity
        order_items.append(models.OrderItem(
            product_id=product.id,
            quantity=item.quantity,
            unit_price=product.price
        ))
 
    if calculated_total != order.total:
        raise HTTPException(status_code=400, detail=f"合計金額が正しくありません（期待値: {calculated_total}, 送信値: {order.total}）")
    
    tendered_total = sum(pm.cash + pm.ticket_100 * 100 + pm.ticket_200 * 200 + pm.emoney for pm in order.payment_method)
 
    if tendered_total < order.total:
        raise HTTPException(status_code=400, detail="支払額は合計金額以上である必要があります")
 
    db_order = models.Order(
        total=order.total,
        change=tendered_total - order.total,
        store_id=store_id,
        items=order_items,
        tendered=tendered_total,
        payment_method=[models.OrderPaymentMethod(
            cash=pm.cash,
            ticket_100=pm.ticket_100,
            ticket_200=pm.ticket_200,
            emoney=pm.emoney
        ) for pm in order.payment_method]
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order
 
def get_all(db: Session, store_id: int, limit: int | None = None, offset: int = 0):
    query = db.query(models.Order).filter(
        models.Order.store_id == store_id
    ).order_by(models.Order.created_at.desc()).offset(offset)
    if limit is not None:
        query = query.limit(limit)
    return query.all()

def get_by_order_no(db: Session, order_no: int, store_id: int):
    order = db.query(models.Order).filter(
        models.Order.id == order_no,
        models.Order.store_id == store_id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"注文番号 {order_no} が見つかりません")
    return order
 
def update(db: Session, order_id: int, order: schemas.OrderCreate, store_id: int):
    db_order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.store_id == store_id
    ).first()
 
    if not db_order:
        raise HTTPException(status_code=404, detail="注文が見つかりません")
 
    if not order.items:
        raise HTTPException(status_code=400, detail="商品が選択されていません")
 
    # 在庫を元に戻す
    for item in db_order.items:
        product = db.query(models.Product).filter(
            models.Product.id == item.product_id,
            models.Product.store_id == store_id
        ).first()
        if product:
            product.stock += item.quantity
 
    # 新しい注文アイテムを作成
    order_items = []
    calculated_total = 0
    for item in order.items:
        product = db.query(models.Product).filter(
            models.Product.store_product_no == item.store_product_no,
            models.Product.store_id == store_id
        ).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"商品番号 {item.store_product_no} が見つかりません")
        if product.stock < item.quantity:
            raise HTTPException(status_code=400, detail=f"{product.name} の在庫が不足しています（残り{product.stock}個）")
 
        subtotal = product.price * item.quantity
        calculated_total += subtotal
        product.stock -= item.quantity
        order_items.append(models.OrderItem(
            product_id=product.id,
            quantity=item.quantity,
            unit_price=product.price
        ))
 
    if calculated_total != order.total:
        raise HTTPException(status_code=400, detail=f"合計金額が正しくありません（期待値: {calculated_total}, 送信値: {order.total}）")
    
    tendered_total = sum(pm.cash + pm.ticket_100 * 100 + pm.ticket_200 * 200 + pm.emoney for pm in order.payment_method)
 
    if tendered_total < order.total:
        raise HTTPException(status_code=400, detail="支払額は合計金額以上である必要があります")
 
    # 注文を更新
    db_order.total = order.total
    db_order.change = tendered_total - order.total
    db_order.tendered = tendered_total
 
    # 新しい注文明細・支払い方法をリレーションに差し替える。
    # items / payment_method は cascade="all, delete-orphan" が設定されているため、
    # ここで代入するだけで古い行の削除と新しい行の追加を SQLAlchemy が行ってくれる。
    db_order.items = order_items
    db_order.payment_method = [
        models.OrderPaymentMethod(
            cash=pm.cash,
            ticket_100=pm.ticket_100,
            ticket_200=pm.ticket_200,
            emoney=pm.emoney
        ) for pm in order.payment_method
    ]
 
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order
 
def delete(db: Session, order_id: int, store_id: int):
    db_order = get_by_order_no(db, order_id, store_id)

    # 在庫を元に戻す（updateの在庫復元処理と同様）
    for item in db_order.items:
        product = db.query(models.Product).filter(
            models.Product.id == item.product_id,
            models.Product.store_id == store_id
        ).first()
        if product:
            product.stock += item.quantity

    db.delete(db_order)
    db.commit()
    return {"message": "削除しました"}