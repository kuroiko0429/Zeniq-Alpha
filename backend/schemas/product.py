from pydantic import BaseModel

class ProductCreate(BaseModel):
    name:  str
    price: int
    stock: int

class ProductResponse(BaseModel):
    id:    int
    store_product_no: int
    name:  str
    price: int
    stock: int
    store_id: int

    model_config = {"from_attributes": True}