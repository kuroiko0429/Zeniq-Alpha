from pydantic import BaseModel, Field

class ProductCreate(BaseModel):
    name:  str
    price: int = Field(ge=0)
    stock: int = Field(ge=0)

class ProductResponse(BaseModel):
    id:    int
    store_product_no: int
    name:  str
    price: int
    stock: int
    store_id: int

    model_config = {"from_attributes": True}