from fastapi import HTTPException
from sqlalchemy.orm import Session
from models.product import Product
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
    db.commit()
    db.refresh(db_product)
    return db_product

def update(db: Session, store_product_no: int, product: schemas.ProductCreate, store_id: int):
    db_product = get_by_store_product_no(db, store_product_no, store_id)
    for key, value in product.model_dump().items():
        setattr(db_product, key, value)
    db.commit()
    db.refresh(db_product)
    return db_product

def delete(db: Session, store_product_no: int, store_id: int):
    db_product = get_by_store_product_no(db, store_product_no, store_id)
    db.delete(db_product)
    db.commit()
    return {"message": "削除しました"}