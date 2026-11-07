-- Markers a learner puts on one answer choice (보기) of a question, apart from the markers on the whole
-- question (question_marks) and on O/X statements (ox_statement_marks).
--
-- Additive: a new table that old code never reads, but the new code reads it with every learner
-- state load, so apply this BEFORE deploying that code.
-- A choice without markers has no row at all.
CREATE TABLE choice_marks (
    learner_id   uuid         NOT NULL,
    question_id  text         NOT NULL,
    choice_index smallint     NOT NULL CHECK (choice_index BETWEEN 0 AND 3),
    mark_count   smallint     NOT NULL CHECK (mark_count BETWEEN 1 AND 5),
    marked_at    timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (learner_id, question_id, choice_index)
);
