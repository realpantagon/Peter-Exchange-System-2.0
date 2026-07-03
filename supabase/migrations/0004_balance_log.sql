-- Append-only log of cash balance entries (opening / closing) per branch per day.
-- Staff can add many entries throughout the day; each is locked once saved.
-- Only root (root pages) may edit/delete existing rows — enforced in the app UI.
--
-- Replaces the single-row-per-day model of Peter_Exchange_Daily_Balance.
-- The old table is left in place (harmless) but no longer used by the app.

create table if not exists public."Peter_Exchange_Balance_Log" (
    id              bigint generated always as identity primary key,
    created_at      timestamptz not null default now(),
    "Date"          date        not null,
    "Branch"        text        not null,
    "Kind"          text        not null check ("Kind" in ('opening', 'closing')),
    "Amount"        numeric     not null default 0,   -- staff-entered cash (opening top-up, or counted closing)
    "System_Snapshot" numeric,                        -- for closing: system-computed closing at save time
    "Note"          text
);

create index if not exists idx_balance_log_date_branch
    on public."Peter_Exchange_Balance_Log" ("Date", "Branch");

alter table public."Peter_Exchange_Balance_Log" enable row level security;

create policy "Allow all access to balance log"
    on public."Peter_Exchange_Balance_Log"
    for all
    using (true)
    with check (true);
