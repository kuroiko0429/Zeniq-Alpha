from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import schemas.product as schemas
from database import get_db
import services.product_service as product_service
from auth.dependencies import get_current_store

router = APIRouter()

@router.get("/api/products", response_model=list[schemas.ProductResponse])
def get_products(
    db: Session = Depends(get_db),
    current_store = Depends(get_current_store)
):
    return product_service.get_all(db, current_store["store_id"])

@router.get("/api/products/{store_product_no}", response_model=schemas.ProductResponse)
def get_product(
    store_product_no: int,
    db: Session = Depends(get_db),
    current_store = Depends(get_current_store)
):
    return product_service.get_by_store_product_no(db, store_product_no, current_store["store_id"])

@router.post("/api/products", response_model=schemas.ProductResponse)
def create_product(
    product: schemas.ProductCreate,
    db: Session = Depends(get_db),
    current_store = Depends(get_current_store)
):
    return product_service.create(db, product, current_store["store_id"])

@router.put("/api/products/{store_product_no}", response_model=schemas.ProductResponse)
def update_product(
    store_product_no: int,
    product: schemas.ProductCreate,
    db: Session = Depends(get_db),
    current_store = Depends(get_current_store)
):
    return product_service.update(db, store_product_no, product, current_store["store_id"])

@router.delete("/api/products/{store_product_no}")
def delete_product(
    store_product_no: int,
    db: Session = Depends(get_db),
    current_store = Depends(get_current_store)
):
    return product_service.delete(db, store_product_no, current_store["store_id"])