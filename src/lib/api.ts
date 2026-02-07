import { supabase } from './supabase'
import type { PeterExchangeRate, PeterExchangeTransaction } from '../types/database'

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

export const getTransactions = async (startDate?: string, branchId?: string): Promise<PeterExchangeTransaction[]> => {
    let query = supabase
        .from('Peter_Exchange_Transaction')
        .select('*')
        .order('created_at', { ascending: false })

    if (startDate) {
        query = query.gte('created_at', startDate)
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
