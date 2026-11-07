-- A word taken off the highlighting (or already memorized) is kept, switched off: its memo, pictures and
-- history stay, and saving the same word again switches it back on.
--
-- Additive: a column with a default, so old code keeps working, but the new code reads it with every
-- learner state load, so apply this BEFORE deploying that code.
ALTER TABLE vocabulary_terms ADD COLUMN active boolean NOT NULL DEFAULT true;
