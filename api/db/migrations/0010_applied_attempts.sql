-- Answers are graded in the browser and sent to the server in batches; every answer carries an id made by
-- the browser, so a batch that is sent twice (a retry after a dropped connection) is counted once.
--
-- Additive: a new table that old code never reads. Rows older than a week are deleted by the API itself.
CREATE TABLE applied_attempts (
    learner_id  uuid         NOT NULL,
    attempt_id  uuid         NOT NULL,
    applied_at  timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY (learner_id, attempt_id)
);
CREATE INDEX applied_attempts_applied_at ON applied_attempts (applied_at);
