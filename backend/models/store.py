from sqlalchemy import Column, Integer, String
from database import Base

class Store(Base):
    __tablename__ = "stores"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String, nullable=False)
    username      = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)