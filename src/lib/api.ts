import type { PeterExchangeRate, PeterExchangeTransaction, PeterExchangeBalanceLog, BalanceLogKind } from '../types/database'

// Talks to the Cloudflare Worker API (worker/src/index.js), which is served
// from the same origin as this app in production and proxied by Vite in dev
// (see vite.config.ts) — so the base path is always just '/api'.
//
// D1 uses snake_case columns and real numbers; the rest of the app still speaks
// the original Supabase-era shapes from ../types/database. The row mappers
// below are the only place that translation happens, which keeps the schema
// clean without a rename rippling through every component.

const API_BASE = '/api'
const API_KEY = import.meta.env.VITE_API_KEY

if (!API_KEY) {
    console.warn('Missing VITE_API_KEY. Please check your .env file.')
}

type Query = Record<string, string | undefined>

async function request<T>(path: string, init?: RequestInit & { query?: Query }): Promise<T> {
    const { query, ...rest } = init ?? {}

    const url = new URL(`${API_BASE}${path}`, window.location.origin)
    for (const [key, value] of Object.entries(query ?? {})) {
        if (value !== undefined && value !== '') url.searchParams.set(key, value)
    }

    const response = await fetch(url, {
        ...rest,
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
            ...rest.headers,
        },
    })

    if (!response.ok) {
        const detail = await response.json().catch(() => null)
        throw new Error(detail?.error || `${rest.method || 'GET'} ${path} failed (${response.status})`)
    }

    return response.status === 204 ? (undefined as T) : response.json()
}

// --- Row mapping -------------------------------------------------------------

// D1 returns numbers where Supabase returned strings; the components format
// these with parseFloat/Number, so hand them strings as before.
const str = (v: number | string | null): string | null => (v === null || v === undefined ? null : String(v))
const num = (v: string | null | undefined): number | null => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

type RateRow = { id: number; currency_code: string; currency_name: string; rate: number }

const toRate = (r: RateRow): PeterExchangeRate => ({
    id: r.id,
    Currency: r.currency_name,
    Cur: r.currency_code,
    Rate: str(r.rate),
})

type TransactionRow = {
    id: number
    created_at: string
    currency_code: string | null
    currency_name: string | null
    rate: number | null
    amount: number | null
    total_thb: number | null
    branch: string | null
    txn_type: string | null
    customer_passport_no: string | null
    customer_nationality: string | null
    customer_name: string | null
}

const toTransaction = (r: TransactionRow): PeterExchangeTransaction => ({
    id: r.id,
    created_at: r.created_at,
    Currency: r.currency_name,
    Rate: str(r.rate),
    Amount: str(r.amount),
    Total_TH: str(r.total_thb),
    Branch: r.branch,
    Transaction_Type: r.txn_type,
    Cur: r.currency_code,
    Customer_Passport_no: r.customer_passport_no,
    Customer_Nationality: r.customer_nationality,
    Customer_Name: r.customer_name,
})

// Only sends the fields actually present, so a partial update stays partial.
const fromTransaction = (t: Partial<PeterExchangeTransaction>): Record<string, unknown> => {
    const body: Record<string, unknown> = {}
    if ('Currency' in t) body.currency_name = t.Currency ?? null
    if ('Cur' in t) body.currency_code = t.Cur ?? null
    if ('Rate' in t) body.rate = num(t.Rate)
    if ('Amount' in t) body.amount = num(t.Amount)
    if ('Total_TH' in t) body.total_thb = num(t.Total_TH)
    if ('Branch' in t) body.branch = t.Branch ?? null
    if ('Transaction_Type' in t) body.txn_type = t.Transaction_Type ?? null
    if ('Customer_Passport_no' in t) body.customer_passport_no = t.Customer_Passport_no ?? null
    if ('Customer_Nationality' in t) body.customer_nationality = t.Customer_Nationality ?? null
    if ('Customer_Name' in t) body.customer_name = t.Customer_Name ?? null
    return body
}

type BalanceLogRow = {
    id: number
    created_at: string
    log_date: string
    branch: string
    kind: BalanceLogKind
    amount: number
    system_snapshot: number | null
    note: string | null
}

const toBalanceLog = (r: BalanceLogRow): PeterExchangeBalanceLog => ({
    id: r.id,
    created_at: r.created_at,
    Date: r.log_date,
    Branch: r.branch,
    Kind: r.kind,
    Amount: r.amount,
    System_Snapshot: r.system_snapshot,
    Note: r.note,
})

// --- Rate Services ---

export const getRates = async (): Promise<PeterExchangeRate[]> => {
    try {
        const rows = await request<RateRow[]>('/rates')
        return rows.map(toRate)
    } catch (error) {
        console.error('Error fetching rates:', error)
        throw error
    }
}

export const updateRate = async (id: number, rate: string): Promise<void> => {
    try {
        await request(`/rates/${id}`, { method: 'PATCH', body: JSON.stringify({ rate: Number(rate) }) })
    } catch (error) {
        console.error('Error updating rate:', error)
        throw error
    }
}

/** One day of rate history for a currency: Super Rich reference vs. the range
 *  of rates we actually gave that day. Nulls where one side has no data. */
export interface RateHistoryRow {
    day: string              // 'YYYY-MM-DD' shop-local
    sr_buying: number | null // Super Rich buying rate
    sr_selling: number | null// Super Rich selling rate
    our_min: number | null   // lowest rate we gave that day
    our_max: number | null   // highest rate we gave that day
    our_avg: number | null   // average rate we gave that day
    count: number            // number of our transactions that day
}

export const getRateHistory = async (code: string, from?: string, to?: string): Promise<RateHistoryRow[]> => {
    try {
        return await request<RateHistoryRow[]>('/rate-history', { query: { code, from, to } })
    } catch (error) {
        console.error('Error fetching rate history:', error)
        throw error
    }
}

/** Latest Super Rich reference rate for one currency code. */
export interface SuperrichRate {
    code: string
    buying: number | null
    selling: number | null
    scraped_at: string
}

/** Force a fresh scrape of today's Super Rich rates, then return the latest set. */
export const refreshSuperrichRates = async (): Promise<SuperrichRate[]> => {
    const res = await request<{ scrape: unknown; latest: SuperrichRate[] }>('/superrich/refresh', { method: 'POST' })
    return res.latest
}

/** Latest stored Super Rich rates (no scrape). */
export const getSuperrichLatest = async (): Promise<SuperrichRate[]> => {
    return request<SuperrichRate[]>('/superrich/latest')
}

// --- Transaction Services ---

/** One day of sales for one branch, already summed by the Worker. */
export interface DailySalesRow {
    day: string      // 'YYYY-MM-DD' in shop-local (Bangkok) time
    branch: string
    total: number    // THB
    count: number    // number of transactions
}

/**
 * Daily sales roll-up for a date range. Use this instead of getTransactions()
 * whenever the screen only needs totals — a year of raw rows is ~3 MB, the same
 * year of daily sums is ~40 KB, which is the difference between a dashboard that
 * loads on a phone and one that appears to have no history at all.
 */
export const getDailySales = async (startDate?: string, endDate?: string, branchId?: string): Promise<DailySalesRow[]> => {
    try {
        const rows = await request<{ day: string; branch: string; total: number | null; count: number }[]>('/summary/daily', {
            query: { from: startDate, to: endDate, branch: branchId },
        })
        return rows.map(r => ({ day: r.day, branch: r.branch, total: Number(r.total) || 0, count: r.count }))
    } catch (error) {
        console.error('Error fetching daily sales summary:', error)
        throw error
    }
}

export const getTransactions = async (startDate?: string, branchId?: string, endDate?: string): Promise<PeterExchangeTransaction[]> => {
    try {
        const rows = await request<TransactionRow[]>('/transactions', {
            query: { from: startDate, to: endDate, branch: branchId },
        })
        return rows.map(toTransaction)
    } catch (error) {
        console.error('Error fetching transactions:', error)
        throw error
    }
}

export const createTransaction = async (transaction: Omit<PeterExchangeTransaction, 'id' | 'created_at'>): Promise<PeterExchangeTransaction> => {
    try {
        const row = await request<TransactionRow>('/transactions', {
            method: 'POST',
            body: JSON.stringify(fromTransaction(transaction)),
        })
        return toTransaction(row)
    } catch (error) {
        console.error('Error creating transaction:', error)
        throw error
    }
}

export const updateTransaction = async (id: number, transaction: Partial<PeterExchangeTransaction>): Promise<PeterExchangeTransaction> => {
    try {
        const row = await request<TransactionRow>(`/transactions/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(fromTransaction(transaction)),
        })
        return toTransaction(row)
    } catch (error) {
        console.error('Error updating transaction:', error)
        throw error
    }
}

export const deleteTransaction = async (id: number): Promise<void> => {
    try {
        await request(`/transactions/${id}`, { method: 'DELETE' })
    } catch (error) {
        console.error('Error deleting transaction:', error)
        throw error
    }
}

// --- Daily Cash Balance Log (Cash Flow) Services ---
// Append-only log: staff add opening/closing entries throughout the day, each locked
// once saved. Only root (root pages) edits/deletes — enforced in the UI.
// Backing table: cash_balance_log (migrations/0001_init.sql).

// Fetch balance-log entries. Optionally filter by date ('YYYY-MM-DD') and/or branch.
// Ordered oldest→newest so the timeline reads top-to-bottom by time.
export const getBalanceLogs = async (date?: string, branchId?: string): Promise<PeterExchangeBalanceLog[]> => {
    try {
        const rows = await request<BalanceLogRow[]>('/balance-logs', { query: { date, branch: branchId } })
        return rows.map(toBalanceLog)
    } catch (error) {
        // Don't crash the cash-flow page if the log can't be read.
        console.warn('[getBalanceLogs] could not load balance log:', error)
        return []
    }
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
    try {
        const row = await request<BalanceLogRow>('/balance-logs', {
            method: 'POST',
            body: JSON.stringify({
                log_date: record.Date,
                branch: record.Branch,
                kind: record.Kind,
                amount: record.Amount,
                system_snapshot: record.System_Snapshot ?? null,
                note: record.Note ?? null,
            }),
        })
        return toBalanceLog(row)
    } catch (error) {
        console.error('Error creating balance log:', error)
        throw error
    }
}

// Root-only: edit an existing entry's amount / note.
export const updateBalanceLog = async (
    id: number,
    patch: { Amount?: number; Note?: string | null }
): Promise<void> => {
    try {
        const body: Record<string, unknown> = {}
        if ('Amount' in patch) body.amount = patch.Amount
        if ('Note' in patch) body.note = patch.Note ?? null

        await request(`/balance-logs/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
    } catch (error) {
        console.error('Error updating balance log:', error)
        throw error
    }
}

// Root-only: delete an entry.
export const deleteBalanceLog = async (id: number): Promise<void> => {
    try {
        await request(`/balance-logs/${id}`, { method: 'DELETE' })
    } catch (error) {
        console.error('Error deleting balance log:', error)
        throw error
    }
}
