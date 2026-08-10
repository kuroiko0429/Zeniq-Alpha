from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import schemas.order as schemas
from database import get_db
import services.order_service as order_service
from auth.dependencies import get_current_store

router = APIRouter()

@router.post("/api/orders", response_model=schemas.OrderResponse)
def create_order(
    order: schemas.OrderCreate,
    db: Session = Depends(get_db),
    current_store = Depends(get_current_store)
):
    return order_service.create(db, order, current_store["store_id"])  # ← store_idを渡す

@router.get("/api/orders", response_model=list[schemas.OrderResponse])
def get_orders(
    db: Session = Depends(get_db),
    current_store = Depends(get_current_store)
):
    return order_service.get_all(db, current_store["store_id"])  # ← store_idで絞り込み

@router.put("/api/orders/{order_id}", response_model=schemas.OrderResponse)
def update_order(
    order_id: int,
    order: schemas.OrderCreate,
    db: Session = Depends(get_db),
    current_store = Depends(get_current_store)
):
    return order_service.update(db, order_id, order, current_store["store_id"])

@router.delete("/api/orders/{order_id}")
def delete_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_store = Depends(get_current_store)
):
    return order_service.delete(db, order_id, current_store["store_id"])