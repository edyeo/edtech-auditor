"""SQLAlchemy Core table definitions. The schema itself is owned by api/db/migrations/*.sql."""
from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    SmallInteger,
    Table,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID

metadata = MetaData()

answer_overrides = Table(
    "answer_overrides",
    metadata,
    Column("question_id", Text, primary_key=True),
    Column("answer_index", SmallInteger, nullable=False),
    Column("also_correct", ARRAY(SmallInteger), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

question_marks = Table(
    "question_marks",
    metadata,
    Column("learner_id", UUID(as_uuid=True), primary_key=True),
    Column("question_id", Text, primary_key=True),
    Column("source", Text, nullable=False),
    Column("marked_at", DateTime(timezone=True), nullable=False),
)

question_stats = Table(
    "question_stats",
    metadata,
    Column("learner_id", UUID(as_uuid=True), primary_key=True),
    Column("question_id", Text, primary_key=True),
    Column("attempts", Integer, nullable=False),
    Column("wrong", Integer, nullable=False),
    Column("streak", Integer, nullable=False),
    Column("last_wrong_at", DateTime(timezone=True)),
)

review_states = Table(
    "review_states",
    metadata,
    Column("learner_id", UUID(as_uuid=True), primary_key=True),
    Column("question_id", Text, primary_key=True),
    Column("box_level", SmallInteger, nullable=False),
    Column("due_at", Date, nullable=False),
    Column("last_confidence", Text, nullable=False),
    Column("last_correct", Boolean, nullable=False),
    Column("attempts", Integer, nullable=False),
    Column("overconfident_miss", Boolean, nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

mini_test_records = Table(
    "mini_test_records",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("learner_id", UUID(as_uuid=True), nullable=False),
    Column("taken_at", DateTime(timezone=True), nullable=False),
    Column("scope_label", Text, nullable=False),
)

mini_test_items = Table(
    "mini_test_items",
    metadata,
    Column("record_id", UUID(as_uuid=True), ForeignKey("mini_test_records.id", ondelete="CASCADE"), primary_key=True),
    Column("position", SmallInteger, primary_key=True),
    Column("question_id", Text, nullable=False),
    Column("selected_index", SmallInteger, nullable=False),
    Column("correct_indexes", ARRAY(SmallInteger), nullable=False),
    Column("is_correct", Boolean, nullable=False),
)

question_explanations = Table(
    "question_explanations",
    metadata,
    Column("question_id", Text, primary_key=True),
    Column("content_hash", Text, primary_key=True),
    Column("explanation", Text, nullable=False),
    Column("provider", Text, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
