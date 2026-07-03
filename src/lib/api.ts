import { supabase } from './supabase'
import type { PeterExchangeRate, PeterExchangeTransaction, PeterExchangeDailyBalance } from '../types/database'

// --- Rate Services ---

export const getRates = async (): Promise<PeterExchangeRate[]> => {
    const { data, error } = await supabase
        .from('Peter_Exchange_Rate')
        .select('*')
        .order('id', { ascending: true })

    if (error) {
        console.error('Error fetching rates:', error)
        throw error
    }

    return data || []
}

export const updateRate = async (id: number, rate: string): Promise<void> => {
    const { error } = await supabase
        .from('Peter_Exchange_Rate')
        .update({ Rate: rate })
        .eq('id', id)

    if (error) {
        console.error('Error updating rate:', error)
        throw error
    }
}

// --- Transaction Services ---

export const getTransactions = async (startDate?: string, branchId?: string, endDate?: string): Promise<PeterExchangeTransaction[]> => {
    let query = supabase
        .from('Peter_Exchange_Transaction')
        .select('*')
        .order('created_at', { ascending: false })

    if (startDate) {
        query = query.gte('created_at', startDate)
    }

    if (endDate) {
        query = query.lte('created_at', endDate)
    }

    if (branchId) {
        query = query.eq('Branch', branchId)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching transactions:', error)
        throw error
    }

    return data || []
}

export const createTransaction = async (transaction: Omit<PeterExchangeTransaction, 'id' | 'created_at'>): Promise<PeterExchangeTransaction> => {
    const { data, error } = await supabase
        .from('Peter_Exchange_Transaction')
        .insert([transaction])
        .select()
        .single()

    if (error) {
        console.error('Error creating transaction:', error)
        throw error
    }

    return data
}

export const updateTransaction = async (id: number, transaction: Partial<PeterExchangeTransaction>): Promise<PeterExchangeTransaction> => {
    const { data, error } = await supabase
        .from('Peter_Exchange_Transaction')
        .update(transaction)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        console.error('Error updating transaction:', error)
        throw error
    }

    return data
}

export const deleteTransaction = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from('Peter_Exchange_Transaction')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting transaction:', error)
        throw error
    }
}

// --- Daily Opening Balance (Cash Flow) Services ---
// IMPORTANT: The `Peter_Exchange_Daily_Balance` table is NOT created in Supabase yet.
// Apply supabase/migrations/0001_daily_balance.sql first. Until then `getDailyBalances`
// fails gracefully (returns []) so the UI keeps working, while writes will throw.

const DAILY_BALANCE_TABLE = 'Peter_Exchange_Daily_Balance'

// Fetch opening balances. Optionally filter by a single date ('YYYY-MM-DD') and/or branch.
export const getDailyBalances = async (date?: string, branchId?: string): Promise<PeterExchangeDailyBalance[]> => {
    let query = supabase
        .from(DAILY_BALANCE_TABLE)
        .select('*')
        .order('Date', { ascending: false })

    if (date) {
        query = query.eq('Date', date)
    }

    if (branchId) {
        query = query.eq('Branch', branchId)
    }

    const { data, error } = await query

    if (error) {
        // Table likely not created yet — degrade gracefully instead of crashing the page.
        console.warn(`[getDailyBalances] "${DAILY_BALANCE_TABLE}" not ready yet:`, error.message)
        return []
    }

    return data || []
}

// Create or update the opening balance for a (Date, Branch) pair.
// Partial upsert on (Date, Branch): only the provided fields are written, so the
// morning "opening" save and the end-of-day "closing" save don't overwrite each other.
export const upsertDailyBalance = async (record: {
    Date: string
    Branch: string
    Opening_Balance?: number
    actual_closing_balance_system?: number
    closing_balance_filled?: number | null
    Note?: string | null
}): Promise<PeterExchangeDailyBalance> => {
    const { data, error } = await supabase
        .from(DAILY_BALANCE_TABLE)
        .upsert(record, { onConflict: 'Date,Branch' })
        .select()
        .single()

    if (error) {
        console.error('Error saving daily balance:', error)
        throw error
    }

    return data
}
