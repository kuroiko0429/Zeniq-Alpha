"""Add unique constraint on (store_id, store_product_no)

同一店舗内で store_product_no が重複しないよう、DBレベルで保証する。
これまで product_service.create() は「現在の最大値+1」をSELECTしてから
INSERTするだけで、同時に2リクエストが来ると同じ番号が重複採番される
競合状態（race condition）があった。アプリ側は IntegrityError を
キャッチして採番をリトライするよう対応済み（services/product_service.py）。

Revision ID: 005_add_unique_store_product_no
Revises: 004_add_is_admin_to_stores
Create Date: 2026-09-25 00:00:00.000000

"""
from alembic import op

revision = '005_add_unique_store_product_no'
down_revision = '004_add_is_admin_to_stores'
branch_labels = None
depends_on = None

def upgrade():
    op.create_unique_constraint(
        'uq_products_store_id_store_product_no',
        'products',
        ['store_id', 'store_product_no']
    )

def downgrade():
    op.drop_constraint(
        'uq_products_store_id_store_product_no',
        'products',
        type_='unique'
    )
