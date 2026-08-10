from database import SessionLocal, engine
from models.store import Store
from services.auth_service import hash_password
import models

models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

if db.query(Store).count() == 0:
    stores = [
        Store(name="焼きそば班",    username="yakisoba",  hashed_password=hash_password("pass1234")),
        Store(name="から揚げ班",    username="karaage",   hashed_password=hash_password("pass1234")),
        Store(name="運営本部",      username="admin",     hashed_password=hash_password("admin1234")),
    ]
    db.add_all(stores)
    db.commit()
    print("✅ 店舗データを登録しました")
else:
    print("ℹ️ 店舗データはすでに存在します")

db.close()