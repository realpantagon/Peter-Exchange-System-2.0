-- Split the single closing balance into:
--   actual_closing_balance_system : computed by the system (opening + cash in - cash out)
--   closing_balance_filled        : counted & entered by staff after closing the day (nullable)
-- Root compares the two to see the over/short difference.
-- Additive & idempotent: safe to run on top of 0001 / 0002.

create table if not exists public."Peter_Exchange_Daily_Balance" (
    id              bigint generated always as identity primary key,
    created_at      timestamptz not null default now(),
    "Date"          date        not null,
    "Branch"        text        not null,
    "Opening_Balance" numeric    not null default 0,
    "Note"          text,
    unique ("Date", "Branch")
);

-- System-computed end-of-day cash (snapshot taken when closing is saved).
alter table public."Peter_Exchange_Daily_Balance"
    add column if not exists actual_closing_balance_system numeric not null default 0;

-- Staff-entered actual counted cash. NULL until staff fills it in after close.
alter table public."Peter_Exchange_Daily_Balance"
    add column if not exists closing_balance_filled numeric;

-- Carry over any value from the old single column, then drop it.
update public."Peter_Exchange_Daily_Balance"
    set actual_closing_balance_system = "Closing_Balance"
    where actual_closing_balance_system = 0
      and "Closing_Balance" is not null
      and "Closing_Balance" <> 0;

alter table public."Peter_Exchange_Daily_Balance"
    drop column if exists "Closing_Balance";
