-- Markers a learner puts on one O/X statement, separate from the markers on the whole question.
--
-- Additive: a new table that old code never reads, so it can be applied before the new code ships
-- (the new code reads it with every learner state load, so apply it BEFORE deploying that code).
-- A statement is identified by its question and its position in api/data/ox_questions.json.
-- A statement without markers has no row at all.
CREATE TABLE ox_statement_marks (
    learner_id      uuid         NOT NULL,
    question_id     text         NOT NULL,
    statement_index smallint     NOT NULL CHECK (statement_index >= 0),
    mark_count      smallint     NOT NULL CHECK (mark_count BETWEEN 1 AND 5),
    marked_at       timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (learner_id, question_id, statement_index)
);
