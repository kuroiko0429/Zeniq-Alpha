from pydantic import BaseModel
from datetime import datetime

class OrderItemCreate(BaseModel):
    store_product_no: int
    quantity:   int

class OrderPaymentMethodCreate(BaseModel):
    cash: int = 0
    ticket_100: int = 0
    ticket_200: int = 0
    emoney: int = 0

class OrderCreate(BaseModel):
    items:    list[OrderItemCreate]
    total:    int
    payment_method: list[OrderPaymentMethodCreate]

class OrderItemResponse(BaseModel):
    product_id: int
    quantity:   int

    model_config = {"from_attributes": True}

class OrderPaymentMethodResponse(BaseModel):
    cash: int
    ticket_100: int
    ticket_200: int
    emoney: int

    model_config = {"from_attributes": True}

class OrderResponse(BaseModel):
    id:         int
    store_id:   int
    created_at: datetime
    items:      list[OrderItemResponse]
    total:      int
    payment_method: list[OrderPaymentMethodResponse]
    tendered:   int
    change:     int
    model_config = {"from_attributes": True}