from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from database import get_db
import schemas.auth as auth_schemas
import services.auth_service as auth_service
from models.store import Store
from auth.dependencies import get_current_store
from rate_limit import limiter

router = APIRouter()

@router.post("/api/auth/login", response_model=auth_schemas.TokenResponse)
@limiter.limit("10/minute")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    store = auth_service.authenticate(db, form_data.username, form_data.password)
    if not store:
        raise HTTPException(status_code=401, detail="ユーザー名またはパスワードが正しくありません")
    token = auth_service.create_token(store.id, store.name, store.is_admin)
    return {"access_token": token, "store_name": store.name}

@router.post("/api/auth/register", response_model=auth_schemas.RegisterResponse)
def register(
    request: auth_schemas.RegisterRequest,
    db: Session = Depends(get_db),
    current_store = Depends(get_current_store)
):
    # 管理者（is_admin）だけ登録できる
    if not current_store.get("is_admin"):
        raise HTTPException(status_code=403, detail="店舗登録は管理者のみ可能です")

    existing = db.query(Store).filter(Store.username == request.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="そのユーザー名はすでに使われています")

    store = Store(
        name=request.name,
        username=request.username,
        hashed_password=auth_service.hash_password(request.password)
    )
    db.add(store)
    db.commit()
    db.refresh(store)
    return store