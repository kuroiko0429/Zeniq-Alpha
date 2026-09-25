"""Add is_admin to stores

管理者判定を店舗名の文字列比較（store_name == "運営本部"）で行っていたのを、
専用のis_adminカラムに置き換えるためのマイグレーションです。
店舗名は /api/auth/register で自由に変更・重複しうる値なので、権限判定には使えません。

Revision ID: 004_add_is_admin_to_stores
Revises: 003_add_payment_methods
Create Date: 2026-09-25 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '004_add_is_admin_to_stores'
down_revision = '003_add_payment_methods'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column(
        'stores',
        sa.Column('is_admin', sa.Boolean(), nullable=False, server_default=sa.false())
    )
    # 既存データの後方互換: 店舗名が「運営本部」の行は管理者として引き継ぐ（一度きりの移行）
    op.execute("UPDATE stores SET is_admin = true WHERE name = '運営本部'")

def downgrade():
    op.drop_column('stores', 'is_admin')
