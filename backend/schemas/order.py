from pydantic import BaseModel, Field
from datetime import datetime

class OrderItemCreate(BaseModel):
    store_product_no: int
    quantity:   int = Field(gt=0)

class OrderPaymentMethodCreate(BaseModel):
    cash: int = Field(default=0, ge=0)
    ticket_100: int = Field(default=0, ge=0)
    ticket_200: int = Field(default=0, ge=0)
    emoney: int = Field(default=0, ge=0)

class OrderCreate(BaseModel):
    items:    list[OrderItemCreate]
    total:    int = Field(ge=0)
    payment_method: list[OrderPaymentMethodCreate]

class OrderItemResponse(BaseModel):
    product_id: int
    quantity:   int
    unit_price: int

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