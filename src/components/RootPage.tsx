import { useState, useEffect, useMemo } from 'react'
import type { JSX } from 'react'
import { Link } from 'react-router-dom'
import { getTransactions, updateTransaction, deleteTransaction } from '../lib/api'
import type { Transaction } from '../utils/currencyUtils'
import RootTransactionTable from './root_component/RootTransactionTable'
import TransactionForm from './system_component/TransactionForm'
import Toast from './system_component/Toast'
import { calculateExchangeTotal } from '../utils/currencyUtils'
import ClientTimeAnalytics from './root_component/ClientTimeAnalytics'
import DailySalesAnalytics from './root_component/DailySalesAnalytics'
import DailyCashFlow from './root_component/DailyCashFlow'

// Fixed list of stores in the transaction system: ร้าน 4 และ ร้าน 11
const BRANCHES = ['4', '11']

const NAV_ITEMS: { to: string; label: string; icon: (props: { className?: string }) => JSX.Element }[] = [
    {
        to: '/root/daily', label: 'รายละเอียดรายวัน', icon: (p) => (
            <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        )
    },
    {
        to: '/', label: 'หน้าจอเรต', icon: (p) => (
            <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 3v18h18M9 17V9m4 8V5m4 12v-6" /></svg>
        )
    },
    {
        to: '/admin2025', label: 'แอดมิน', icon: (p) => (
            <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        )
    },
    {
        to: '/superadmin2025', label: 'ซูเปอร์แอดมิน', icon: (p) => (
            <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        )
    },
]

export default function RootPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
    const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null) // Default to All (within range)
    const [rangeDays, setRangeDays] = useState<number>(30) // How far back to fetch/analyze

    // Toast state
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

    // Date badges for the table: keep to the most recent days so the bar stays usable
    const badgeDays = Math.min(rangeDays, 14)
    const availableDates = Array.from({ length: badgeDays }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (badgeDays - 1 - i))
        return d
    }).reverse() // Today first

    useEffect(() => {
        fetchTransactions()
        // Reset day filter when range changes to avoid filtering to an out-of-range day
        setSelectedDateFilter(null)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rangeDays])

    const fetchTransactions = async () => {
        setLoading(true)
        try {
            // Calculate the start date based on the selected range
            const d = new Date()
            d.setDate(d.getDate() - rangeDays)
            const startDate = d.toISOString()

            const data = await getTransactions(startDate)
            setTransactions(data)
        } catch (error) {
            console.error('Error fetching transactions:', error)
            setToast({ message: 'Failed to fetch transactions', type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    const handleEditTransaction = (transaction: Transaction) => {
        setEditingTransaction(transaction)
    }

    const handleDeleteTransaction = async (transaction: Transaction) => {
        if (!transaction.id) return

        if (window.confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
            try {
                await deleteTransaction(transaction.id)
                setToast({ message: 'Transaction deleted successfully', type: 'success' })
                fetchTransactions()
            } catch (error) {
                console.error('Error deleting transaction:', error)
                setToast({ message: 'Failed to delete transaction', type: 'error' })
            }
        }
    }

    const handleSaveTransaction = async (updatedTx: Transaction) => {
        try {
            if (!updatedTx.id) return

            // Recalculate Total_TH
            const totalTHB = calculateExchangeTotal(updatedTx.Rate || '0', updatedTx.Amount || '0')

            const txToUpdate = {
                Customer_Name: updatedTx.Customer_Name,
                Customer_Passport_no: updatedTx.Customer_Passport_no,
                Customer_Nationality: updatedTx.Customer_Nationality,
                Amount: updatedTx.Amount,
                Rate: updatedTx.Rate,
                Total_TH: totalTHB,
                Cur: updatedTx.Cur,
                Transaction_Type: updatedTx.Transaction_Type,
                Branch: updatedTx.Branch
            }

            await updateTransaction(updatedTx.id, txToUpdate)
            setToast({ message: 'Transaction updated successfully', type: 'success' })
            setEditingTransaction(null)
            fetchTransactions()
        } catch (error) {
            console.error('Error updating transaction:', error)
            setToast({ message: 'Failed to update transaction', type: 'error' })
        }
    }

    const handleCancelEdit = () => {
        setEditingTransaction(null)
    }

    const filteredTransactions = transactions.filter(transaction => {
        if (!transaction.created_at) return false

        if (selectedDateFilter) {
            const transactionDate = new Date(transaction.created_at).toDateString()
            return transactionDate === selectedDateFilter
        }

        return true
    })

    // Today's ledger — the page's opening thesis: is today in the black or the red, per branch.
    const todayLedger = useMemo(() => {
        const todayKey = new Date().toDateString()
        const perBranch: Record<string, { in: number; out: number; count: number }> = {}
        BRANCHES.forEach(b => (perBranch[b] = { in: 0, out: 0, count: 0 }))
        let grandIn = 0
        let grandOut = 0
        let grandCount = 0

        transactions.forEach(t => {
            if (!t.created_at || !t.Branch) return
            if (new Date(t.created_at).toDateString() !== todayKey) return
            if (!perBranch[t.Branch]) perBranch[t.Branch] = { in: 0, out: 0, count: 0 }

            const total = Math.abs(parseFloat(t.Total_TH || '0') || 0)
            if (t.Transaction_Type === 'Selling') {
                perBranch[t.Branch].in += total
                grandIn += total
            } else {
                perBranch[t.Branch].out += total
                grandOut += total
            }
            perBranch[t.Branch].count += 1
            grandCount += 1
        })

        return { perBranch, grandIn, grandOut, grandNet: grandIn - grandOut, grandCount }
    }, [transactions])

    const fmt = (v: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(v)

    return (
        <div className="root-vault min-h-screen flex flex-col">
            {/* Header */}
            <div
                className="px-4 sm:px-6 py-3.5 flex flex-wrap justify-between items-center gap-3 sticky top-0 z-20"
                style={{ backgroundColor: 'var(--vault-panel)', borderBottom: '1px solid var(--vault-hairline)' }}
            >
                <div className="flex items-center gap-4">
                    <div
                        className="rounded-lg px-3 py-1.5 flex items-center"
                        style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid rgba(184, 134, 11,0.35)' }}
                    >
                        <img src="/Ex_logo_6.png" alt="Peter Exchange" className="h-7 w-auto" />
                    </div>
                    <span
                        className="hidden md:inline-block text-[11px] font-semibold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full"
                        style={{ color: 'var(--vault-brass)', border: '1px solid rgba(184, 134, 11,0.35)' }}
                    >
                        Root Ledger
                    </span>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* เปิดระบบทำรายการไวๆ แยกตามร้าน */}
                    <div className="flex items-center gap-2">
                        {BRANCHES.map(b => (
                            <Link
                                key={b}
                                to={`/system2025?branchid=${b}`}
                                className="px-3.5 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors"
                                style={{ backgroundColor: 'var(--vault-brass)', color: '#1a1305' }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--vault-brass-bright)')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--vault-brass)')}
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4" />
                                </svg>
                                <span>เปิดระบบ ร้าน {b}</span>
                            </Link>
                        ))}
                    </div>

                    {/* Quick navigation to other pages */}
                    <nav className="flex flex-wrap items-center gap-1">
                        {NAV_ITEMS.map(item => (
                            <Link
                                key={item.to}
                                to={item.to}
                                className="px-2.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
                                style={{ color: 'var(--vault-muted)' }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--vault-paper)'; e.currentTarget.style.backgroundColor = 'var(--vault-panel-raised)' }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--vault-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}
                            >
                                <item.icon className="w-4 h-4" />
                                <span className="hidden lg:inline">{item.label}</span>
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>

            <div className="flex-1 p-4 sm:p-6 w-full mx-auto space-y-5">

                {/* Today's Ledger — hero strip */}
                <div
                    className="rounded-2xl overflow-hidden"
                    style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)' }}
                >
                    <div className="flex flex-wrap items-center justify-between gap-2 px-5 sm:px-6 pt-4">
                        <h1 className="font-display text-base sm:text-lg font-semibold tracking-tight" style={{ color: 'var(--vault-paper)' }}>
                            บัญชีวันนี้
                            <span className="ml-2 font-normal text-xs" style={{ color: 'var(--vault-muted)' }}>
                                {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                        </h1>
                        <span className="font-figure text-xs" style={{ color: 'var(--vault-muted)' }}>
                            {todayLedger.grandCount} รายการวันนี้
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-px mt-4" style={{ backgroundColor: 'var(--vault-hairline)' }}>
                        {BRANCHES.map(b => {
                            const row = todayLedger.perBranch[b] || { in: 0, out: 0, count: 0 }
                            const net = row.in - row.out
                            return (
                                <div key={b} className="p-5 sm:p-6" style={{ backgroundColor: 'var(--vault-panel)' }}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span
                                            className="w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center font-figure"
                                            style={{ backgroundColor: 'var(--vault-panel-raised)', color: 'var(--vault-brass)', border: '1px solid rgba(184, 134, 11,0.4)' }}
                                        >
                                            {b}
                                        </span>
                                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--vault-muted)' }}>ร้าน {b}</span>
                                    </div>
                                    <div
                                        className="font-figure text-3xl font-semibold tabular-nums"
                                        style={{ color: net >= 0 ? 'var(--vault-ink-credit)' : 'var(--vault-ink-debit)' }}
                                    >
                                        {net >= 0 ? '+' : '−'}฿ {' '}{fmt(Math.abs(net))}
                                    </div>
                                    <div className="mt-2 flex items-center gap-3 text-xs font-figure">
                                        <span style={{ color: 'var(--vault-ink-credit)' }}>รับ +฿ {fmt(row.in)}</span>
                                        <span style={{ color: 'var(--vault-ink-debit)' }}>จ่าย −฿ {fmt(row.out)}</span>
                                        <span style={{ color: 'var(--vault-muted)' }}>{row.count} รายการ</span>
                                    </div>
                                </div>
                            )
                        })}

                        {/* Grand total — the emphasized brass plate */}
                        <div className="p-5 sm:p-6 relative" style={{ backgroundColor: 'var(--vault-panel-raised)' }}>
                            <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: 'var(--vault-brass)' }} />
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--vault-brass)' }}>รวมทุกร้าน</span>
                            </div>
                            <div
                                className="font-figure text-3xl font-semibold tabular-nums"
                                style={{ color: todayLedger.grandNet >= 0 ? 'var(--vault-ink-credit)' : 'var(--vault-ink-debit)' }}
                            >
                                {todayLedger.grandNet >= 0 ? '+' : '−'}฿ {fmt(Math.abs(todayLedger.grandNet))}
                            </div>
                            <div className="mt-2 flex items-center gap-3 text-xs font-figure">
                                <span style={{ color: 'var(--vault-ink-credit)' }}>รับ +฿ {fmt(todayLedger.grandIn)}</span>
                                <span style={{ color: 'var(--vault-ink-debit)' }}>จ่าย −฿ {fmt(todayLedger.grandOut)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Daily Cash Flow (opening balance -> closing balance per branch) */}
                <DailyCashFlow
                    transactions={transactions}
                    notify={(message, type) => setToast({ message, type })}
                    isRoot
                />

                {/* Daily Sales per Branch (uses full range data, has its own branch filter) */}
                <DailySalesAnalytics
                    transactions={transactions}
                    rangeDays={rangeDays}
                    setRangeDays={setRangeDays}
                />

                {/* Client Analytics Graph */}
                <ClientTimeAnalytics transactions={filteredTransactions} />

                {/* Transaction Table */}
                <RootTransactionTable
                    transactions={filteredTransactions}
                    loading={loading}
                    onRefresh={fetchTransactions}
                    selectedDateFilter={selectedDateFilter}
                    setSelectedDateFilter={setSelectedDateFilter}
                    availableDates={availableDates} // 10 Days
                    onEditTransaction={handleEditTransaction}
                    onDeleteTransaction={handleDeleteTransaction}
                />
            </div>

            {/* Modals */}
            {editingTransaction && (
                <EditTransactionModal
                    transaction={editingTransaction}
                    onSave={handleSaveTransaction}
                    onCancel={handleCancelEdit}
                />
            )}

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    )
}

function EditTransactionModal({
    transaction,
    onSave,
    onCancel
}: {
    transaction: Transaction
    onSave: (t: Transaction) => void
    onCancel: () => void
}) {
    const [customRate, setCustomRate] = useState(transaction.Rate || '')
    const [amount, setAmount] = useState(transaction.Amount || '')
    const [transactionType, setTransactionType] = useState(transaction.Transaction_Type || '')
    const [passportNo, setPassportNo] = useState(transaction.Customer_Passport_no || '')
    const [nationality, setNationality] = useState(transaction.Customer_Nationality || '')
    const [customerName, setCustomerName] = useState(transaction.Customer_Name || '')

    const calculateTotal = () => {
        const amt = parseFloat(amount)
        const rate = parseFloat(customRate)
        if (isNaN(amt) || isNaN(rate)) return '0.00'
        return (amt * rate).toFixed(2)
    }

    const handleSave = () => {
        const updatedTransaction = {
            ...transaction,
            Rate: customRate,
            Amount: amount,
            Transaction_Type: transactionType,
            Customer_Passport_no: passportNo,
            Customer_Nationality: nationality,
            Customer_Name: customerName,
            Total_TH: calculateTotal()
        }
        onSave(updatedTransaction)
    }

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div
                className="rounded-2xl w-[600px] max-w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)' }}
            >
                <div className="px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--vault-hairline)' }}>
                    <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--vault-paper)' }}>แก้ไขรายการ</h2>
                    <p className="font-figure text-xs mt-0.5" style={{ color: 'var(--vault-muted)' }}>#{transaction.id}</p>
                </div>
                <div className="p-6 rounded-b-2xl" style={{ backgroundColor: 'var(--vault-panel)' }}>
                    <TransactionForm
                        customRate={customRate}
                        setCustomRate={setCustomRate}
                        amount={amount}
                        setAmount={setAmount}
                        transactionType={transactionType}
                        setTransactionType={setTransactionType}
                        passportNo={passportNo}
                        setPassportNo={setPassportNo}
                        nationality={nationality}
                        setNationality={setNationality}
                        customerName={customerName}
                        setCustomerName={setCustomerName}
                        calculateTotal={calculateTotal}
                        onSave={handleSave}
                        onCancel={onCancel}
                        isEditing={true}
                    />
                </div>
            </div>
        </div>
    )
}
