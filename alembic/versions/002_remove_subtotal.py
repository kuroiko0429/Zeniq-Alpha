"""Remove subtotal from order_items

このマイグレーションは元々 order_items.subtotal カラムの削除を意図していましたが、
001_initial では subtotal カラム自体を作成していないため、単純な drop_column では
「column "subtotal" does not exist」エラーになります。
カラムが存在する場合のみ削除するよう、存在チェックを入れて安全化しています。

Revision ID: 002_remove_subtotal
Revises: 001_initial
Create Date: 2026-06-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '002_remove_subtotal'
down_revision = '001_initial'
branch_labels = None
depends_on = None

def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col["name"] for col in inspector.get_columns("order_items")]
    if "subtotal" in columns:
        op.drop_column('order_items', 'subtotal')

def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col["name"] for col in inspector.get_columns("order_items")]
    if "subtotal" not in columns:
        op.add_column('order_items', sa.Column('subtotal', sa.Integer(), nullable=False, server_default='0'))
