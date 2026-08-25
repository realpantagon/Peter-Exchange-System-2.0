-- Peter Exchange 2.0 — initial D1 schema
--
-- Replaces the former Supabase (Postgres) tables. Names are snake_case to match
-- `superrich_rates`, which the rate scraper already writes to.
--
--   Peter_Exchange_Rate          -> board_rates
--   Peter_Exchange_Transaction   -> transactions
--   Peter_Exchange_Balance_Log   -> cash_balance_log
--   Peter_Exchange_Daily_Balance -> dropped (superseded by cash_balance_log)
--
-- Money/rate columns are REAL here (they were text in Supabase).
-- Timestamps are ISO-8601 UTC strings, so lexicographic ordering matches
-- chronological ordering and `new Date(...)` parses them in every browser.

-- The shop's own posted rates — one row per currency, edited on /admin2025.
-- Compare against `superrich_rates` (the competitor rates the worker scrapes).
CREATE TABLE IF NOT EXISTS board_rates (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    currency_code TEXT NOT NULL UNIQUE,   -- was "Cur":      USD, USD2, USD1, EUR, ...
    currency_name TEXT NOT NULL,          -- was "Currency": US Dollar $50-100, ...
    rate          REAL NOT NULL,
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS transactions (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    currency_code        TEXT,            -- was "Cur"
    currency_name        TEXT,            -- was "Currency"
    rate                 REAL,
    amount               REAL,            -- amount in the foreign currency
    total_thb            REAL,            -- was "Total_TH"
    branch               TEXT,
    txn_type             TEXT CHECK (txn_type IN ('Buying', 'Selling')),
    customer_passport_no TEXT,
    customer_nationality TEXT,
    customer_name        TEXT
);

CREATE INDEX IF NOT EXISTS idx_txn_created_at     ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_txn_branch_created ON transactions(branch, created_at);
CREATE INDEX IF NOT EXISTS idx_txn_currency_code  ON transactions(currency_code);

-- Append-only log of cash balance entries per branch per day. Staff append
-- entries throughout the day (each locked once saved); only root edits/deletes.
CREATE TABLE IF NOT EXISTS cash_balance_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    log_date        TEXT NOT NULL,        -- was "Date", 'YYYY-MM-DD'. `date` is a SQLite function name.
    branch          TEXT NOT NULL,
    kind            TEXT NOT NULL CHECK (kind IN ('opening', 'closing')),
    amount          REAL NOT NULL DEFAULT 0,   -- staff-entered cash (opening top-up, or counted closing)
    system_snapshot REAL,                      -- for closing: system-computed closing at save time
    note            TEXT
);

CREATE INDEX IF NOT EXISTS idx_cash_log_date_branch ON cash_balance_log(log_date, branch);

-- Super Rich competitor rates, scraped daily by the worker's cron trigger.
-- Already exists on the remote database (created ad-hoc before migrations were
-- introduced); repeated here so `wrangler dev --local` gets a complete schema.
-- Column order/nullability mirrors the live table exactly (`code` was added
-- later via ALTER TABLE), so local and remote stay in sync.
CREATE TABLE IF NOT EXISTS superrich_rates (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    scraped_at   TEXT NOT NULL,
    currency     TEXT NOT NULL,
    country_name TEXT,
    denomination TEXT,
    buying       REAL,
    selling      REAL,
    created_date TEXT NOT NULL,
    code         TEXT
);

CREATE INDEX        IF NOT EXISTS idx_scraped_at       ON superrich_rates(scraped_at);
CREATE INDEX        IF NOT EXISTS idx_currency         ON superrich_rates(currency);
CREATE INDEX        IF NOT EXISTS idx_created_date     ON superrich_rates(created_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_date_code ON superrich_rates(created_date, code);
