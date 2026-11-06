-- How often a learner has answered each O/X statement, and how often wrongly.
--
-- Additive: a new table that old code never reads, so it can be applied before the new code ships.
-- A statement is identified by its question and its position in api/data/ox_questions.json.
CREATE TABLE ox_statement_stats (
    learner_id      uuid         NOT NULL,
    question_id     text         NOT NULL,
    statement_index smallint     NOT NULL CHECK (statement_index >= 0),
    attempts        integer      NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    wrong           integer      NOT NULL DEFAULT 0 CHECK (wrong >= 0 AND wrong <= attempts),
    last_attempt_at timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (learner_id, question_id, statement_index)
);
