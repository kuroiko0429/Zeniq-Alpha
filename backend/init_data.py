from database import SessionLocal, engine
from models.store import Store
import models
import schemas.product as product_schemas
from services.product_service import create

models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

if db.query(models.Product).count() == 0:
    yakisoba_store = db.query(Store).filter(Store.username == "yakisoba").first()
    karaage_store  = db.query(Store).filter(Store.username == "karaage").first()

    initial_products = [
        (product_schemas.ProductCreate(name="焼きそば",      price=500, stock=100), yakisoba_store.id),
        (product_schemas.ProductCreate(name="から揚げ",      price=300, stock=150), karaage_store.id),
        (product_schemas.ProductCreate(name="フランクフルト", price=200, stock=200), karaage_store.id),
    ]

    for product, store_id in initial_products:
        create(db, product, store_id)  # ← store_product_noを自動採番

    print("✅ 初期商品データを登録しました")
else:
    print("ℹ️ 商品データはすでに存在します")

db.close()