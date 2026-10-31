from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.tables import mini_test_items, mini_test_records, question_marks, question_stats, review_states
from api.models.learner import MAX_MARK_COUNT, MarkOut, MiniTestItem, MiniTestRecord, ReviewState, StatsOut

MAX_MINI_TEST_RECORDS = 100


class LearnerRepository:
    """All SQL for one learner's marks, attempt stats, review states and mini test history.

    Every method is parameterized Core SQL; the service decides transaction boundaries.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ---- reads -------------------------------------------------------------------------------

    async def get_marks(self, learner_id: UUID) -> dict[str, MarkOut]:
        rows = await self._session.execute(
            select(
                question_marks.c.question_id,
                question_marks.c.marked_at,
                question_marks.c.source,
                question_marks.c.mark_count,
            ).where(question_marks.c.learner_id == learner_id)
        )
        return {
            r.question_id: MarkOut(marked_at=r.marked_at, source=r.source, count=r.mark_count) for r in rows
        }

    async def get_stats(self, learner_id: UUID) -> dict[str, StatsOut]:
        rows = await self._session.execute(
            select(question_stats).where(question_stats.c.learner_id == learner_id)
        )
        return {
            r.question_id: StatsOut(attempts=r.attempts, wrong=r.wrong, streak=r.streak, last_wrong_at=r.last_wrong_at)
            for r in rows
        }

    async def get_review(self, learner_id: UUID) -> dict[str, ReviewState]:
        rows = await self._session.execute(select(review_states).where(review_states.c.learner_id == learner_id))
        return {
            r.question_id: ReviewState(
                box_level=r.box_level,
                due_at=r.due_at,
                last_confidence=r.last_confidence,
                last_correct=r.last_correct,
                attempts=r.attempts,
                overconfident_miss=r.overconfident_miss,
            )
            for r in rows
        }

    async def list_mini_tests(self, learner_id: UUID, limit: int = MAX_MINI_TEST_RECORDS) -> list[MiniTestRecord]:
        records = (
            await self._session.execute(
                select(mini_test_records)
                .where(mini_test_records.c.learner_id == learner_id)
                .order_by(mini_test_records.c.taken_at.desc())
                .limit(limit)
            )
        ).all()
        if not records:
            return []
        items = await self._session.execute(
            select(mini_test_items)
            .where(mini_test_items.c.record_id.in_([r.id for r in records]))
            .order_by(mini_test_items.c.record_id, mini_test_items.c.position)
        )
        by_record: dict[UUID, list[MiniTestItem]] = {}
        for item in items:
            by_record.setdefault(item.record_id, []).append(
                MiniTestItem(
                    question_id=item.question_id,
                    selected_index=item.selected_index,
                    correct_indexes=list(item.correct_indexes),
                    is_correct=item.is_correct,
                )
            )
        return [
            MiniTestRecord(
                id=str(r.id), taken_at=r.taken_at, scope_label=r.scope_label, items=by_record.get(r.id, [])
            )
            for r in records
        ]

    async def lock_learner(self, learner_id: UUID) -> None:
        """Serialize writers that do check-then-insert for one learner (held until the transaction ends)."""
        await self._session.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:learner, 0))"), {"learner": str(learner_id)}
        )

    async def has_any_data(self, learner_id: UUID) -> bool:
        for table in (question_marks, question_stats, review_states, mini_test_records):
            count = await self._session.scalar(
                select(func.count()).select_from(table).where(table.c.learner_id == learner_id)
            )
            if count:
                return True
        return False

    # ---- marks -------------------------------------------------------------------------------

    async def add_mark(
        self, learner_id: UUID, question_id: str, source: str, marked_at: datetime | None = None
    ) -> None:
        """Insert a single-marker mark if the question has none yet (used by the local-data import)."""
        await self._session.execute(
            insert(question_marks)
            .values(
                learner_id=learner_id,
                question_id=question_id,
                source=source,
                marked_at=marked_at or datetime.now(UTC),
                mark_count=1,
            )
            .on_conflict_do_nothing(index_elements=[question_marks.c.learner_id, question_marks.c.question_id])
        )

    async def bump_mark(self, learner_id: UUID, question_id: str, source: str) -> MarkOut:
        """Add one marker (capped) in ONE statement, so concurrent wrong answers can't lose an increment."""
        stmt = insert(question_marks).values(
            learner_id=learner_id,
            question_id=question_id,
            source=source,
            marked_at=datetime.now(UTC),
            mark_count=1,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[question_marks.c.learner_id, question_marks.c.question_id],
            set_={"mark_count": func.least(question_marks.c.mark_count + 1, MAX_MARK_COUNT)},
        ).returning(question_marks.c.marked_at, question_marks.c.source, question_marks.c.mark_count)
        row = (await self._session.execute(stmt)).one()
        return MarkOut(marked_at=row.marked_at, source=row.source, count=row.mark_count)

    async def set_mark_count(self, learner_id: UUID, question_id: str, count: int) -> MarkOut:
        """Set the marker count by hand; an existing mark keeps its original source and date."""
        stmt = insert(question_marks).values(
            learner_id=learner_id,
            question_id=question_id,
            source="manual",
            marked_at=datetime.now(UTC),
            mark_count=count,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[question_marks.c.learner_id, question_marks.c.question_id],
            set_={"mark_count": count},
        ).returning(question_marks.c.marked_at, question_marks.c.source, question_marks.c.mark_count)
        row = (await self._session.execute(stmt)).one()
        return MarkOut(marked_at=row.marked_at, source=row.source, count=row.mark_count)

    async def remove_mark(self, learner_id: UUID, question_id: str) -> None:
        await self._session.execute(
            delete(question_marks).where(
                question_marks.c.learner_id == learner_id, question_marks.c.question_id == question_id
            )
        )

    # ---- stats -------------------------------------------------------------------------------

    async def record_attempt(self, learner_id: UUID, question_id: str, is_correct: bool) -> StatsOut:
        """Atomic counter update in ONE statement, so concurrent submits can't lose increments."""
        now = datetime.now(UTC)
        stmt = insert(question_stats).values(
            learner_id=learner_id,
            question_id=question_id,
            attempts=1,
            wrong=0 if is_correct else 1,
            streak=0 if is_correct else 1,
            last_wrong_at=None if is_correct else now,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[question_stats.c.learner_id, question_stats.c.question_id],
            set_={
                "attempts": question_stats.c.attempts + 1,
                "wrong": question_stats.c.wrong + (0 if is_correct else 1),
                "streak": 0 if is_correct else question_stats.c.streak + 1,
                "last_wrong_at": question_stats.c.last_wrong_at if is_correct else now,
            },
        ).returning(
            question_stats.c.attempts, question_stats.c.wrong, question_stats.c.streak, question_stats.c.last_wrong_at
        )
        row = (await self._session.execute(stmt)).one()
        return StatsOut(attempts=row.attempts, wrong=row.wrong, streak=row.streak, last_wrong_at=row.last_wrong_at)

    async def reset_streak(self, learner_id: UUID, question_id: str) -> StatsOut | None:
        row = (
            await self._session.execute(
                question_stats.update()
                .where(question_stats.c.learner_id == learner_id, question_stats.c.question_id == question_id)
                .values(streak=0)
                .returning(
                    question_stats.c.attempts,
                    question_stats.c.wrong,
                    question_stats.c.streak,
                    question_stats.c.last_wrong_at,
                )
            )
        ).first()
        return (
            StatsOut(attempts=row.attempts, wrong=row.wrong, streak=row.streak, last_wrong_at=row.last_wrong_at)
            if row
            else None
        )

    async def import_stats(self, learner_id: UUID, question_id: str, stats: StatsOut) -> None:
        await self._session.execute(
            insert(question_stats)
            .values(learner_id=learner_id, question_id=question_id, **stats.model_dump())
            .on_conflict_do_nothing(index_elements=[question_stats.c.learner_id, question_stats.c.question_id])
        )

    # ---- review state ------------------------------------------------------------------------

    async def upsert_review(self, learner_id: UUID, question_id: str, state: ReviewState) -> None:
        values = {**state.model_dump(), "updated_at": datetime.now(UTC)}
        await self._session.execute(
            insert(review_states)
            .values(learner_id=learner_id, question_id=question_id, **values)
            .on_conflict_do_update(
                index_elements=[review_states.c.learner_id, review_states.c.question_id], set_=values
            )
        )

    # ---- mini test history -------------------------------------------------------------------

    async def insert_mini_test(self, learner_id: UUID, record: MiniTestRecord) -> None:
        record_id = UUID(record.id)
        await self._session.execute(
            insert(mini_test_records)
            .values(id=record_id, learner_id=learner_id, taken_at=record.taken_at, scope_label=record.scope_label)
            .on_conflict_do_nothing(index_elements=[mini_test_records.c.id])
        )
        if record.items:
            await self._session.execute(
                insert(mini_test_items)
                .values(
                    [
                        {
                            "record_id": record_id,
                            "position": position,
                            "question_id": item.question_id,
                            "selected_index": item.selected_index,
                            "correct_indexes": item.correct_indexes,
                            "is_correct": item.is_correct,
                        }
                        for position, item in enumerate(record.items)
                    ]
                )
                .on_conflict_do_nothing(index_elements=[mini_test_items.c.record_id, mini_test_items.c.position])
            )

    async def trim_mini_tests(self, learner_id: UUID, keep: int = MAX_MINI_TEST_RECORDS) -> None:
        """Keep only the newest `keep` tests; items go with them via ON DELETE CASCADE."""
        stale = (
            select(mini_test_records.c.id)
            .where(mini_test_records.c.learner_id == learner_id)
            .order_by(mini_test_records.c.taken_at.desc())
            .offset(keep)
        )
        await self._session.execute(delete(mini_test_records).where(mini_test_records.c.id.in_(stale)))
