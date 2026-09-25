"""Add unit_price to order_items

注文明細に購入時点の単価スナップショットを追加する。これまで
product_id と quantity しか保持しておらず、単価を持っていなかった。
あとから商品価格を変更すると、過去の注文明細の「単価×数量」を
再現できなくなる問題があった（Order.total 自体は作成時点の値の
まま保持されるので合計だけは正しいが、明細レベルの内訳が壊れる）。

既存データは products.price で一括バックフィルする（あくまで近似値。
過去に価格変更があった場合の「本当の」購入時単価とは異なりうるが、
他に手がかりがないための救済措置）。

Revision ID: 006_add_order_item_unit_price
Revises: 005_add_unique_store_product_no
Create Date: 2026-09-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '006_add_order_item_unit_price'
down_revision = '005_add_unique_store_product_no'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('order_items', sa.Column('unit_price', sa.Integer(), nullable=True))
    op.execute("""
        UPDATE order_items
        SET unit_price = products.price
        FROM products
        WHERE order_items.product_id = products.id
    """)
    # バックフィル後、対応するproductが見つからなかった行（削除済み商品など）は0で埋める
    op.execute("UPDATE order_items SET unit_price = 0 WHERE unit_price IS NULL")
    op.alter_column('order_items', 'unit_price', existing_type=sa.Integer(), nullable=False)

def downgrade():
    op.drop_column('order_items', 'unit_price')
