"""Add payment_methods table

Order.payment_method (OrderPaymentMethod) リレーションに対応するテーブルを追加します。
1注文に対して、現金・100円券・200円券・電子マネーを組み合わせて複数件登録できるよう、
orders への外部キー（order_id）を持つ1対多の構成です。

Revision ID: 003_add_payment_methods
Revises: 002_remove_subtotal
Create Date: 2026-06-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '003_add_payment_methods'
down_revision = '002_remove_subtotal'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'payment_methods',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('cash', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ticket_100', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ticket_200', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('emoney', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_payment_methods_id'), 'payment_methods', ['id'], unique=False)

def downgrade():
    op.drop_index(op.f('ix_payment_methods_id'), table_name='payment_methods')
    op.drop_table('payment_methods')
