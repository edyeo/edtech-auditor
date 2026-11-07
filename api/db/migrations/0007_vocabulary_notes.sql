-- The vocabulary list grows into concept notes: the memo is Markdown (longer), a note can carry
-- a section (subject) of its own, and it can hold a few images.
--
-- Additive: a nullable column, a relaxed length check and a new table that old code never reads,
-- but the new code reads the images table with every learner state load, so apply this BEFORE
-- deploying that code.
ALTER TABLE vocabulary_terms
    ADD COLUMN section text CHECK (section IS NULL OR char_length(section) <= 30),
    DROP CONSTRAINT vocabulary_terms_memo_check,
    ADD CONSTRAINT vocabulary_terms_memo_check CHECK (char_length(memo) <= 20000);

-- Images are kept in the database (compressed in the browser first); the API caps their size, their
-- number per note and the total per learner. They go with their note.
CREATE TABLE vocabulary_images (
    id           uuid         PRIMARY KEY,
    learner_id   uuid         NOT NULL,
    term_key     text         NOT NULL,
    content_type text         NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp')),
    size         integer      NOT NULL CHECK (size > 0),
    data         bytea        NOT NULL,
    created_at   timestamptz  NOT NULL DEFAULT now(),
    FOREIGN KEY (learner_id, term_key) REFERENCES vocabulary_terms (learner_id, term_key) ON DELETE CASCADE
);
CREATE INDEX vocabulary_images_learner_term ON vocabulary_images (learner_id, term_key);
