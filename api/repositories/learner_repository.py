from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import delete, func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.tables import (
    applied_attempts,
    choice_marks,
    mini_test_items,
    mini_test_records,
    ox_statement_marks,
    ox_statement_stats,
    question_marks,
    question_stats,
    review_states,
    vocabulary_images,
    vocabulary_terms,
)
from api.models.learner import (
    MAX_MARK_COUNT,
    MarkOut,
    MiniTestItem,
    MiniTestRecord,
    OxStatsOut,
    ReviewState,
    StatsOut,
    VocabularyImageOut,
    VocabularyTermOut,
    term_key,
)

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

    async def get_ox_stats(self, learner_id: UUID) -> dict[str, OxStatsOut]:
        rows = await self._session.execute(
            select(ox_statement_stats).where(ox_statement_stats.c.learner_id == learner_id)
        )
        return {
            f"{r.question_id}#{r.statement_index}": OxStatsOut(
                attempts=r.attempts, wrong=r.wrong, last_attempt_at=r.last_attempt_at
            )
            for r in rows
        }

    async def get_ox_marks(self, learner_id: UUID) -> dict[str, MarkOut]:
        rows = await self._session.execute(
            select(
                ox_statement_marks.c.question_id,
                ox_statement_marks.c.statement_index,
                ox_statement_marks.c.marked_at,
                ox_statement_marks.c.mark_count,
            ).where(ox_statement_marks.c.learner_id == learner_id)
        )
        return {
            f"{r.question_id}#{r.statement_index}": MarkOut(marked_at=r.marked_at, source="manual", count=r.mark_count)
            for r in rows
        }

    async def get_vocabulary(self, learner_id: UUID) -> dict[str, VocabularyTermOut]:
        rows = await self._session.execute(select(vocabulary_terms).where(vocabulary_terms.c.learner_id == learner_id))
        images = await self._image_list(learner_id)
        return {r.term_key: self._to_term(r, images.get(r.term_key, [])) for r in rows}

    async def _image_list(self, learner_id: UUID, key: str | None = None) -> dict[str, list[VocabularyImageOut]]:
        """Image metadata (never the bytes) per term key, oldest first."""
        query = select(
            vocabulary_images.c.id, vocabulary_images.c.term_key, vocabulary_images.c.content_type, vocabulary_images.c.size
        ).where(vocabulary_images.c.learner_id == learner_id)
        if key is not None:
            query = query.where(vocabulary_images.c.term_key == key)
        by_key: dict[str, list[VocabularyImageOut]] = {}
        for r in await self._session.execute(query.order_by(vocabulary_images.c.created_at, vocabulary_images.c.id)):
            by_key.setdefault(r.term_key, []).append(
                VocabularyImageOut(id=str(r.id), content_type=r.content_type, size=r.size)
            )
        return by_key

    @staticmethod
    def _to_term(row, images: list[VocabularyImageOut]) -> VocabularyTermOut:  # noqa: ANN001 - a SQLAlchemy Row
        return VocabularyTermOut(
            term=row.term,
            memo=row.memo,
            studied=row.studied,
            active=row.active,
            source_question_id=row.source_question_id,
            section=row.section,
            images=images,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    async def get_choice_marks(self, learner_id: UUID) -> dict[str, MarkOut]:
        rows = await self._session.execute(
            select(
                choice_marks.c.question_id,
                choice_marks.c.choice_index,
                choice_marks.c.marked_at,
                choice_marks.c.mark_count,
            ).where(choice_marks.c.learner_id == learner_id)
        )
        return {
            f"{r.question_id}#{r.choice_index}": MarkOut(marked_at=r.marked_at, source="manual", count=r.mark_count)
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
        for table in (
            question_marks, question_stats, review_states, mini_test_records, ox_statement_stats, ox_statement_marks, choice_marks, vocabulary_terms
        ):
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

    async def set_ox_mark_count(
        self, learner_id: UUID, question_id: str, statement_index: int, count: int
    ) -> MarkOut:
        """Set the marker count of one O/X statement; an existing mark keeps its original date."""
        stmt = insert(ox_statement_marks).values(
            learner_id=learner_id,
            question_id=question_id,
            statement_index=statement_index,
            mark_count=count,
            marked_at=datetime.now(UTC),
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[
                ox_statement_marks.c.learner_id,
                ox_statement_marks.c.question_id,
                ox_statement_marks.c.statement_index,
            ],
            set_={"mark_count": count},
        ).returning(ox_statement_marks.c.marked_at, ox_statement_marks.c.mark_count)
        row = (await self._session.execute(stmt)).one()
        return MarkOut(marked_at=row.marked_at, source="manual", count=row.mark_count)

    async def set_choice_mark_count(
        self, learner_id: UUID, question_id: str, choice_index: int, count: int
    ) -> MarkOut:
        """Set the marker count of one answer choice; an existing mark keeps its original date."""
        stmt = insert(choice_marks).values(
            learner_id=learner_id,
            question_id=question_id,
            choice_index=choice_index,
            mark_count=count,
            marked_at=datetime.now(UTC),
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[choice_marks.c.learner_id, choice_marks.c.question_id, choice_marks.c.choice_index],
            set_={"mark_count": count},
        ).returning(choice_marks.c.marked_at, choice_marks.c.mark_count)
        row = (await self._session.execute(stmt)).one()
        return MarkOut(marked_at=row.marked_at, source="manual", count=row.mark_count)

    async def remove_choice_mark(self, learner_id: UUID, question_id: str, choice_index: int) -> None:
        await self._session.execute(
            delete(choice_marks).where(
                choice_marks.c.learner_id == learner_id,
                choice_marks.c.question_id == question_id,
                choice_marks.c.choice_index == choice_index,
            )
        )

    async def remove_ox_mark(self, learner_id: UUID, question_id: str, statement_index: int) -> None:
        await self._session.execute(
            delete(ox_statement_marks).where(
                ox_statement_marks.c.learner_id == learner_id,
                ox_statement_marks.c.question_id == question_id,
                ox_statement_marks.c.statement_index == statement_index,
            )
        )

    # ---- vocabulary --------------------------------------------------------------------------------

    async def count_terms(self, learner_id: UUID) -> int:
        return (
            await self._session.scalar(
                select(func.count()).select_from(vocabulary_terms).where(vocabulary_terms.c.learner_id == learner_id)
            )
            or 0
        )

    async def add_term(
        self, learner_id: UUID, term: str, source_question_id: str | None, section: str | None
    ) -> VocabularyTermOut:
        """Save the term, or return the one already saved: its memo and study state stay as they are, and a
        word that was switched off is switched on again."""
        now = datetime.now(UTC)
        key = term_key(term)
        await self._session.execute(
            insert(vocabulary_terms)
            .values(
                learner_id=learner_id,
                term_key=key,
                term=term,
                memo="",
                studied=False,
                active=True,
                source_question_id=source_question_id,
                section=section,
                created_at=now,
                updated_at=now,
            )
            .on_conflict_do_update(
                index_elements=[vocabulary_terms.c.learner_id, vocabulary_terms.c.term_key],
                set_={"active": True, "updated_at": now},
                where=vocabulary_terms.c.active.is_(False),
            )
        )
        row = (
            await self._session.execute(
                select(vocabulary_terms).where(
                    vocabulary_terms.c.learner_id == learner_id, vocabulary_terms.c.term_key == key
                )
            )
        ).one()
        return self._to_term(row, (await self._image_list(learner_id, key)).get(key, []))

    async def update_term(
        self,
        learner_id: UUID,
        term: str,
        memo: str | None,
        studied: bool | None,
        section: str | None,
        active: bool | None = None,
    ) -> VocabularyTermOut | None:
        """Change only the given fields (an empty section clears it); None when the term is not saved."""
        values: dict[str, object] = {"updated_at": datetime.now(UTC)}
        if memo is not None:
            values["memo"] = memo
        if studied is not None:
            values["studied"] = studied
        if active is not None:
            values["active"] = active
        if section is not None:
            values["section"] = section or None
        row = (
            await self._session.execute(
                vocabulary_terms.update()
                .where(vocabulary_terms.c.learner_id == learner_id, vocabulary_terms.c.term_key == term_key(term))
                .values(**values)
                .returning(*vocabulary_terms.c)
            )
        ).first()
        if row is None:
            return None
        key = term_key(term)
        return self._to_term(row, (await self._image_list(learner_id, key)).get(key, []))

    async def remove_term(self, learner_id: UUID, term: str) -> None:
        await self._session.execute(
            delete(vocabulary_terms).where(
                vocabulary_terms.c.learner_id == learner_id, vocabulary_terms.c.term_key == term_key(term)
            )
        )

    async def count_images(self, learner_id: UUID, term: str) -> tuple[int, int]:
        """(images on this note, bytes of all the learner's images)."""
        per_term = await self._session.scalar(
            select(func.count())
            .select_from(vocabulary_images)
            .where(vocabulary_images.c.learner_id == learner_id, vocabulary_images.c.term_key == term_key(term))
        )
        total = await self._session.scalar(
            select(func.coalesce(func.sum(vocabulary_images.c.size), 0)).where(vocabulary_images.c.learner_id == learner_id)
        )
        return per_term or 0, int(total or 0)

    async def has_term(self, learner_id: UUID, term: str) -> bool:
        return bool(
            await self._session.scalar(
                select(func.count())
                .select_from(vocabulary_terms)
                .where(vocabulary_terms.c.learner_id == learner_id, vocabulary_terms.c.term_key == term_key(term))
            )
        )

    async def add_image(self, learner_id: UUID, term: str, content_type: str, data: bytes) -> VocabularyImageOut:
        image_id = uuid4()
        await self._session.execute(
            insert(vocabulary_images).values(
                id=image_id,
                learner_id=learner_id,
                term_key=term_key(term),
                content_type=content_type,
                size=len(data),
                data=data,
                created_at=datetime.now(UTC),
            )
        )
        return VocabularyImageOut(id=str(image_id), content_type=content_type, size=len(data))

    async def get_image(self, learner_id: UUID, image_id: UUID) -> tuple[str, bytes] | None:
        row = (
            await self._session.execute(
                select(vocabulary_images.c.content_type, vocabulary_images.c.data).where(
                    vocabulary_images.c.id == image_id, vocabulary_images.c.learner_id == learner_id
                )
            )
        ).first()
        return (row.content_type, bytes(row.data)) if row else None

    async def remove_image(self, learner_id: UUID, image_id: UUID) -> bool:
        result = await self._session.execute(
            delete(vocabulary_images).where(vocabulary_images.c.id == image_id, vocabulary_images.c.learner_id == learner_id)
        )
        return result.rowcount > 0

    # ---- answers sent in batches -------------------------------------------------------------

    async def claim_attempts(self, learner_id: UUID, attempt_ids: list[UUID]) -> set[UUID]:
        """Remember these answer ids; returns the ones not seen before (the rest were counted by an earlier send)."""
        if not attempt_ids:
            return set()
        now = datetime.now(UTC)
        rows = await self._session.execute(
            insert(applied_attempts)
            .values([{"learner_id": learner_id, "attempt_id": i, "applied_at": now} for i in attempt_ids])
            .on_conflict_do_nothing(index_elements=[applied_attempts.c.learner_id, applied_attempts.c.attempt_id])
            .returning(applied_attempts.c.attempt_id)
        )
        return {r.attempt_id for r in rows}

    async def prune_attempts(self, learner_id: UUID, keep_days: int = 7) -> None:
        """Answer ids only matter while a retry of their batch is possible."""
        cutoff = datetime.now(UTC) - timedelta(days=keep_days)
        await self._session.execute(
            delete(applied_attempts).where(
                applied_attempts.c.learner_id == learner_id, applied_attempts.c.applied_at < cutoff
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

    async def record_ox_attempt(
        self, learner_id: UUID, question_id: str, statement_index: int, is_correct: bool
    ) -> OxStatsOut:
        """Atomic counter update in ONE statement, so concurrent answers can't lose an increment."""
        now = datetime.now(UTC)
        stmt = insert(ox_statement_stats).values(
            learner_id=learner_id,
            question_id=question_id,
            statement_index=statement_index,
            attempts=1,
            wrong=0 if is_correct else 1,
            last_attempt_at=now,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[
                ox_statement_stats.c.learner_id,
                ox_statement_stats.c.question_id,
                ox_statement_stats.c.statement_index,
            ],
            set_={
                "attempts": ox_statement_stats.c.attempts + 1,
                "wrong": ox_statement_stats.c.wrong + (0 if is_correct else 1),
                "last_attempt_at": now,
            },
        ).returning(
            ox_statement_stats.c.attempts, ox_statement_stats.c.wrong, ox_statement_stats.c.last_attempt_at
        )
        row = (await self._session.execute(stmt)).one()
        return OxStatsOut(attempts=row.attempts, wrong=row.wrong, last_attempt_at=row.last_attempt_at)

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
