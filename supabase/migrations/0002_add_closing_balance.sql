-- Add end-of-day closing cash balance per branch per day.
-- Additive & idempotent: safe to run whether or not 0001 was applied.
-- Frontend (src/lib/api.ts: upsertDailyBalance / getDailyBalances,
-- src/components/root_component/DailyCashFlow.tsx) is wired to this column.

-- Ensure the base table exists (mirrors 0001_daily_balance.sql).
create table if not exists public."Peter_Exchange_Daily_Balance" (
    id              bigint generated always as identity primary key,
    created_at      timestamptz not null default now(),
    "Date"          date        not null,
    "Branch"        text        not null,
    "Opening_Balance" numeric    not null default 0,
    "Note"          text,
    unique ("Date", "Branch")
);

-- New column: cash counted / recorded at end of day.
alter table public."Peter_Exchange_Daily_Balance"
    add column if not exists "Closing_Balance" numeric not null default 0;
