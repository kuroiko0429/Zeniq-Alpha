from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from models.product import Product
from models.order import OrderItem
import schemas.product as schemas

def get_all(db: Session, store_id: int):
    return db.query(Product).filter(Product.store_id == store_id).all()

def get_by_store_product_no(db: Session, store_product_no: int, store_id: int):
    product = db.query(Product).filter(
        Product.store_product_no == store_product_no,
        Product.store_id == store_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail=f"商品番号 {store_product_no} が見つかりません")
    return product

def create(db: Session, product: schemas.ProductCreate, store_id: int):
    # store_product_noには(store_id, store_product_no)のDB一意制約があるため、
    # 同時リクエストで番号が競合した場合は採番し直してリトライする。
    for _ in range(3):
        last = db.query(Product).filter(
            Product.store_id == store_id
        ).order_by(Product.store_product_no.desc()).first()

        next_no = (last.store_product_no + 1) if last else 1

        db_product = Product(
            **product.model_dump(),
            store_id=store_id,
            store_product_no=next_no
        )
        db.add(db_product)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            continue
        db.refresh(db_product)
        return db_product

    raise HTTPException(status_code=409, detail="商品番号の採番に失敗しました。もう一度お試しください。")

def update(db: Session, store_product_no: int, product: schemas.ProductCreate, store_id: int):
    db_product = get_by_store_product_no(db, store_product_no, store_id)
    for key, value in product.model_dump().items():
        setattr(db_product, key, value)
    db.commit()
    db.refresh(db_product)
    return db_product

def delete(db: Session, store_product_no: int, store_id: int):
    db_product = get_by_store_product_no(db, store_product_no, store_id)

    has_orders = db.query(OrderItem).filter(
        OrderItem.product_id == db_product.id
    ).first() is not None
    if has_orders:
        raise HTTPException(
            status_code=400,
            detail=f"{db_product.name} は過去の注文で使用されているため削除できません"
        )

    db.delete(db_product)
    db.commit()
    return {"message": "削除しました"}