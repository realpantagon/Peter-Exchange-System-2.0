import { supabase } from './supabase'
import type { PeterExchangeRate, PeterExchangeTransaction, PeterExchangeBalanceLog, BalanceLogKind } from '../types/database'

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

// --- Daily Cash Balance Log (Cash Flow) Services ---
// Append-only log: staff add opening/closing entries throughout the day, each locked
// once saved. Only root (root pages) edits/deletes — enforced in the UI.
// Backing table: supabase/migrations/0004_balance_log.sql. Reads degrade gracefully
// (return []) until the table exists.

const BALANCE_LOG_TABLE = 'Peter_Exchange_Balance_Log'

// Fetch balance-log entries. Optionally filter by date ('YYYY-MM-DD') and/or branch.
// Ordered oldest→newest so the timeline reads top-to-bottom by time.
export const getBalanceLogs = async (date?: string, branchId?: string): Promise<PeterExchangeBalanceLog[]> => {
    let query = supabase
        .from(BALANCE_LOG_TABLE)
        .select('*')
        .order('created_at', { ascending: true })

    if (date) {
        query = query.eq('Date', date)
    }

    if (branchId) {
        query = query.eq('Branch', branchId)
    }

    const { data, error } = await query

    if (error) {
        // Table likely not created yet — degrade gracefully instead of crashing the page.
        console.warn(`[getBalanceLogs] "${BALANCE_LOG_TABLE}" not ready yet:`, error.message)
        return []
    }

    return data || []
}

// Append a new (locked) balance-log entry.
export const createBalanceLog = async (record: {
    Date: string
    Branch: string
    Kind: BalanceLogKind
    Amount: number
    System_Snapshot?: number | null
    Note?: string | null
}): Promise<PeterExchangeBalanceLog> => {
    const { data, error } = await supabase
        .from(BALANCE_LOG_TABLE)
        .insert(record)
        .select()
        .single()

    if (error) {
        console.error('Error creating balance log:', error)
        throw error
    }

    return data
}

// Root-only: edit an existing entry's amount / note.
export const updateBalanceLog = async (
    id: number,
    patch: { Amount?: number; Note?: string | null }
): Promise<void> => {
    const { error } = await supabase
        .from(BALANCE_LOG_TABLE)
        .update(patch)
        .eq('id', id)

    if (error) {
        console.error('Error updating balance log:', error)
        throw error
    }
}

// Root-only: delete an entry.
export const deleteBalanceLog = async (id: number): Promise<void> => {
    const { error } = await supabase
        .from(BALANCE_LOG_TABLE)
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting balance log:', error)
        throw error
    }
}
