-- A question can carry several markers: each wrong answer adds one and the learner can add or
-- remove them by hand. A question without markers has no row at all.
--
-- Additive on purpose: existing rows become one marker, and code that does not know the column yet
-- keeps working (the default applies), so this can be applied before the new code is deployed.
ALTER TABLE question_marks
    ADD COLUMN mark_count smallint NOT NULL DEFAULT 1 CHECK (mark_count BETWEEN 1 AND 5);
