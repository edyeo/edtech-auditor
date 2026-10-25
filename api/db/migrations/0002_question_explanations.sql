-- Cached LLM explanations, one per question, so a question is never explained (and billed) twice.
--
-- Schema layers: external = POST /api/explain; conceptual = a question-level explanation of the
-- correct answer and each wrong choice; internal = the table below.
-- Key: (question_id, content_hash). content_hash is a SHA-256 of the stem, choices and answer key
-- the text was written for, so an admin answer correction naturally selects (and generates) a new
-- explanation instead of serving a stale one; old rows stay as history.
-- Normal form: 3NF - provider/created_at depend on the whole key.
-- Capacity: ~600 questions x a handful of answer-key revisions; each text is a few KB.
-- Consistency: writers take pg_advisory_xact_lock on the key, re-check, then INSERT .. ON CONFLICT
-- DO NOTHING, so concurrent requests produce exactly one LLM call. Expand-only migration.

CREATE TABLE question_explanations (
    question_id  text         NOT NULL,
    content_hash text         NOT NULL,
    explanation  text         NOT NULL CHECK (length(btrim(explanation)) > 0),
    provider     text         NOT NULL,
    created_at   timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (question_id, content_hash)
);
