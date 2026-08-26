-- Daily snapshot of the suggested-rate forecast, one row per (forecast_date, code).
-- Written by the cron after each scrape (and backfillable). Lets us measure how
-- close the suggestion was to the rate we actually gave, and tune the model.
CREATE TABLE IF NOT EXISTS rate_forecast_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    forecast_date TEXT NOT NULL,   -- shop day (YYYY-MM-DD) the forecast is for
    code          TEXT NOT NULL,
    sr_buying     REAL,            -- Super Rich buying used
    avg_margin    REAL,            -- recency-weighted, outlier-filtered margin
    suggested     REAL,            -- sr_buying − avg_margin
    samples       INTEGER,         -- days that fed the margin
    sr_trend      TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_forecast_log_date_code
    ON rate_forecast_log(forecast_date, code);
