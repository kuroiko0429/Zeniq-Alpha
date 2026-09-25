"""Make products.stock NOT NULL

在庫（stock）はビジネスロジック上必須の値であり、NULLを許容すべきではない
（アプリ側は在庫比較 product.stock < item.quantity を行っており、
NULLだと比較結果が常にNULL/Falseになり在庫チェックが素通りしてしまう）。
既存のNULL行は0として扱う。

Revision ID: 007_products_stock_not_null
Revises: 006_add_order_item_unit_price
Create Date: 2026-09-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '007_products_stock_not_null'
down_revision = '006_add_order_item_unit_price'
branch_labels = None
depends_on = None

def upgrade():
    op.execute("UPDATE products SET stock = 0 WHERE stock IS NULL")
    op.alter_column(
        'products', 'stock',
        existing_type=sa.Integer(),
        nullable=False,
        server_default='0'
    )

def downgrade():
    op.alter_column(
        'products', 'stock',
        existing_type=sa.Integer(),
        nullable=True,
        server_default=None
    )
