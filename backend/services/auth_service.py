from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from models.store import Store
from auth.dependencies import SECRET_KEY, ALGORITHM

EXPIRE_MINUTES = 60 * 8

pwd_context = CryptContext(schemes=["bcrypt"])

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def hash_password(password):
    return pwd_context.hash(password)

def authenticate(db: Session, username: str, password: str):
    store = db.query(Store).filter(Store.username == username).first()
    if not store or not verify_password(password, store.hashed_password):
        return None
    return store

def create_token(store_id: int, store_name: str):
    payload = {
        "store_id":   store_id,
        "store_name": store_name,
        "exp": datetime.utcnow() + timedelta(minutes=EXPIRE_MINUTES)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)