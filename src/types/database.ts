export type PeterExchangeRate = {
    id: number
    Currency: string | null
    Cur: string | null
    Rate: string | null
}

// Append-only log of cash balance entries per branch per day.
// Staff append entries (each locked once saved); root can edit/delete.
// Backing table: supabase/migrations/0004_balance_log.sql
export type BalanceLogKind = 'opening' | 'closing'

export type PeterExchangeBalanceLog = {
    id: number
    created_at: string
    Date: string            // 'YYYY-MM-DD'
    Branch: string
    Kind: BalanceLogKind    // 'opening' (morning / top-up) | 'closing' (end-of-day count)
    Amount: number          // staff-entered cash
    System_Snapshot: number | null // for closing: system-computed closing at save time
    Note: string | null
}

export type PeterExchangeTransaction = {
    id: number
    created_at: string
    Currency: string | null
    Rate: string | null
    Amount: string | null
    Total_TH: string | null
    Branch: string | null
    Transaction_Type: string | null
    Cur: string | null
    Customer_Passport_no: string | null
    Customer_Nationality: string | null
    Customer_Name: string | null
}
