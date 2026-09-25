from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from database import Base

class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        # 同一店舗内でstore_product_noが重複しないようにする
        # （alembic/versions/005_add_unique_store_product_no.py と対応）
        UniqueConstraint('store_id', 'store_product_no', name='uq_products_store_id_store_product_no'),
    )

    id    = Column(Integer, primary_key=True, index=True)
    store_product_no = Column(Integer, nullable=False)
    name  = Column(String, nullable=False)
    price = Column(Integer, nullable=False)
    stock = Column(Integer, nullable=False, default=0)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)