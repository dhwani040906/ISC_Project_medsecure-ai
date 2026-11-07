"""Stage 6: physician review records

Revision ID: b61a3d5c7e90
Revises: e99b4406c318
"""
from alembic import op
import sqlalchemy as sa
revision = "b61a3d5c7e90"
down_revision = "e99b4406c318"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("clinical_reviews",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("prediction_id", sa.String(36), sa.ForeignKey("predictions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("doctor_id", sa.String(36), sa.ForeignKey("doctors.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("comments", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("prediction_id", "doctor_id", name="uq_review_prediction_doctor"))
    op.create_index("ix_clinical_reviews_prediction_id", "clinical_reviews", ["prediction_id"])
    op.create_index("ix_clinical_reviews_doctor_id", "clinical_reviews", ["doctor_id"])

def downgrade():
    op.drop_index("ix_clinical_reviews_doctor_id", table_name="clinical_reviews")
    op.drop_index("ix_clinical_reviews_prediction_id", table_name="clinical_reviews")
    op.drop_table("clinical_reviews")
