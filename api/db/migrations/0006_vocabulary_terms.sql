-- Words a learner saved from the questions to study later, with their own memo.
--
-- Additive: a new table that old code never reads, but the new code reads it with every learner
-- state load, so apply this BEFORE deploying that code.
-- term_key is the term lower-cased with single spaces: "Critical Path" and "critical  path" are one word.
CREATE TABLE vocabulary_terms (
    learner_id         uuid         NOT NULL,
    term_key           text         NOT NULL CHECK (char_length(term_key) BETWEEN 1 AND 100),
    term               text         NOT NULL CHECK (char_length(term) BETWEEN 1 AND 100),
    memo               text         NOT NULL DEFAULT '' CHECK (char_length(memo) <= 2000),
    studied            boolean      NOT NULL DEFAULT false,
    source_question_id text,
    created_at         timestamptz  NOT NULL DEFAULT now(),
    updated_at         timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (learner_id, term_key)
);
