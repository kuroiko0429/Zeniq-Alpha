from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Order(Base):
    __tablename__ = "orders"

    id         = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    total      = Column(Integer, nullable=False)
    payment_method = relationship("OrderPaymentMethod", back_populates="order", cascade="all, delete-orphan")
    tendered   = Column(Integer, nullable=False)
    change     = Column(Integer, nullable=False)

class OrderItem(Base):
    __tablename__ = "order_items"

    id         = Column(Integer, primary_key=True, index=True)
    order_id   = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity   = Column(Integer, nullable=False)
    unit_price = Column(Integer, nullable=False)  # 購入時点の単価スナップショット

    order   = relationship("Order", back_populates="items")
    product = relationship("Product")

class OrderPaymentMethod(Base):
    __tablename__ = "payment_methods"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    cash = Column(Integer, nullable=False, default=0)
    ticket_100 = Column(Integer, nullable=False, default=0)
    ticket_200 = Column(Integer, nullable=False, default=0)
    emoney = Column(Integer, nullable=False, default=0)

    order = relationship("Order", back_populates="payment_method")