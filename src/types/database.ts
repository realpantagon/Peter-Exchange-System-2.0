export type PeterExchangeRate = {
    id: number
    Currency: string | null
    Cur: string | null
    Rate: string | null
}

// Opening cash balance per branch per day (for daily cash-flow tracking).
// NOTE: backing table `Peter_Exchange_Daily_Balance` is NOT yet created in Supabase.
// See supabase/migrations/0001_daily_balance.sql — apply it when ready.
export type PeterExchangeDailyBalance = {
    id: number
    created_at: string
    Date: string            // 'YYYY-MM-DD'
    Branch: string
    Opening_Balance: number // starting THB cash for the day (staff, every morning)
    actual_closing_balance_system: number  // system-computed: opening + cash in - cash out
    closing_balance_filled: number | null  // staff-counted cash entered after close (null until filled)
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
