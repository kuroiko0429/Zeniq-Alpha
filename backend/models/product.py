from sqlalchemy import Column, Integer, String, ForeignKey
from database import Base

class Product(Base):
    __tablename__ = "products"

    id    = Column(Integer, primary_key=True, index=True)
    store_product_no = Column(Integer, nullable=False)
    name  = Column(String, nullable=False)
    price = Column(Integer, nullable=False)
    stock = Column(Integer, default=0)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False) 