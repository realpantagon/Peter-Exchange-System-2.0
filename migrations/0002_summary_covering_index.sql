-- Covering index for the dashboard's daily roll-up (GET /api/summary/daily).
--
-- That query reads every row in the selected range (up to a year, ~11.5k rows)
-- and only ever touches created_at, branch and total_thb. idx_txn_created_at
-- narrows the range scan but SQLite still has to visit each table row to pick
-- up branch/total_thb. With all three columns in the index the aggregate is
-- answered from the index alone — no table lookups at all.
CREATE INDEX IF NOT EXISTS idx_txn_created_branch_total
    ON transactions(created_at, branch, total_thb);
