-- Daily opening cash balance per branch (for cash-flow tracking).
-- Apply this in Supabase (SQL editor or `supabase db push`) when ready.
-- The frontend (src/lib/api.ts: getDailyBalances / upsertDailyBalance) is already
-- wired to this table; reads degrade gracefully until the table exists.

create table if not exists public."Peter_Exchange_Daily_Balance" (
    id              bigint generated always as identity primary key,
    created_at      timestamptz not null default now(),
    "Date"          date        not null,
    "Branch"        text        not null,
    "Opening_Balance" numeric    not null default 0,
    "Note"          text,
    unique ("Date", "Branch")
);

create index if not exists idx_daily_balance_date
    on public."Peter_Exchange_Daily_Balance" ("Date");

-- Mirror the access model used by the other Peter_Exchange_* tables.
-- Adjust the policy to your auth setup before relying on it in production.
alter table public."Peter_Exchange_Daily_Balance" enable row level security;

create policy "Allow all access to daily balance"
    on public."Peter_Exchange_Daily_Balance"
    for all
    using (true)
    with check (true);
