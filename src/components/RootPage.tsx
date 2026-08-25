import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getTransactions, getDailySales, updateTransaction, deleteTransaction, type DailySalesRow } from '../lib/api'
import type { Transaction } from '../utils/currencyUtils'
import RootTransactionTable from './root_component/RootTransactionTable'
import TransactionForm from './system_component/TransactionForm'
import Toast from './system_component/Toast'
import { calculateExchangeTotal } from '../utils/currencyUtils'
import ClientTimeAnalytics from './root_component/ClientTimeAnalytics'
import DailySalesAnalytics from './root_component/DailySalesAnalytics'

// The raw ledger below the charts is a "what happened recently" tool, so it
// loads a fixed recent window instead of the whole selected range — a year of
// raw rows is ~3 MB and would stall the page on a phone. The charts read the
// server-side daily roll-up instead, which covers the full range for ~40 KB.
const RAW_WINDOW_DAYS = 31

export default function RootPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [dailySales, setDailySales] = useState<DailySalesRow[]>([])
    const [loading, setLoading] = useState(true)
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
    const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null) // Default to All (within range)
    const [rangeDays, setRangeDays] = useState<number>(30) // How far back to fetch/analyze
    const [showAllTransactions, setShowAllTransactions] = useState(false) // "รายการทั้งหมด" is collapsed by default — rarely used vs /root/daily

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
            // Charts: daily totals across the whole selected range (cheap)
            const summaryStart = new Date()
            summaryStart.setDate(summaryStart.getDate() - rangeDays)

            // Raw ledger: only the recent window (see RAW_WINDOW_DAYS)
            const rawStart = new Date()
            rawStart.setDate(rawStart.getDate() - Math.min(rangeDays, RAW_WINDOW_DAYS))

            const [summary, rows] = await Promise.all([
                getDailySales(summaryStart.toISOString()),
                getTransactions(rawStart.toISOString()),
            ])

            setDailySales(summary)
            setTransactions(rows)
        } catch (error) {
            console.error('Error fetching transactions:', error)
            setToast({ message: 'โหลดข้อมูลไม่สำเร็จ', type: 'error' })
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

    return (
        <div className="root-vault min-h-screen">
            <div className="flex-1 p-4 sm:p-6 w-full mx-auto space-y-5">
                <h1 className="font-display text-xl font-bold" style={{ color: 'var(--vault-paper)' }}>ภาพรวม</h1>

                {/* Daily Sales per Branch (server-side daily totals for the whole
                    range, its own branch filter, raw rows fetched per opened day) */}
                <DailySalesAnalytics
                    daily={dailySales}
                    rangeDays={rangeDays}
                    setRangeDays={setRangeDays}
                    loading={loading}
                />

                {/* Client Analytics Graph */}
                <ClientTimeAnalytics
                    transactions={filteredTransactions}
                    windowLabel={rangeDays > RAW_WINDOW_DAYS ? `${RAW_WINDOW_DAYS} วันล่าสุด` : undefined}
                />

                {/* All transactions — collapsed by default. /root/daily already covers
                    the common "look at one day" case with a friendlier layout, so this
                    raw searchable table is here for the rarer full-history lookup. */}
                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)' }}>
                    <div className="w-full flex items-center gap-3 px-5 sm:px-6 py-4">
                        <button
                            onClick={() => setShowAllTransactions(v => !v)}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
                        >
                            <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-brass-border)' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" style={{ color: 'var(--vault-brass)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
                                </svg>
                            </span>
                            <span className="flex-1 min-w-0">
                                <span className="block font-display text-sm font-bold" style={{ color: 'var(--vault-paper)' }}>รายการธุรกรรมทั้งหมด</span>
                                <span className="block text-xs mt-0.5" style={{ color: 'var(--vault-muted)' }}>
                                    {filteredTransactions.length} รายการ
                                    {rangeDays > RAW_WINDOW_DAYS && ` (${RAW_WINDOW_DAYS} วันล่าสุด)`}
                                    {' · '}{showAllTransactions ? 'กำลังแสดงอยู่ — แตะเพื่อซ่อน' : 'แตะเพื่อค้นหา/ดูตารางแบบละเอียด'}
                                </span>
                            </span>
                        </button>

                        <Link
                            to="/root/daily"
                            className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0 transition-colors"
                            style={{ color: 'var(--vault-brass)', border: '1px solid var(--vault-brass-border)' }}
                        >
                            ดูรายละเอียดรายวัน
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                        </Link>

                        <button
                            onClick={() => setShowAllTransactions(v => !v)}
                            className="shrink-0 p-1"
                            title={showAllTransactions ? 'ซ่อนตาราง' : 'แสดงตาราง'}
                        >
                            <svg className={`w-5 h-5 transition-transform ${showAllTransactions ? 'rotate-180' : ''}`} style={{ color: 'var(--vault-brass)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>

                    {showAllTransactions && (
                        <div className="px-3 pb-3 sm:px-4 sm:pb-4 pt-1" style={{ borderTop: '1px solid var(--vault-hairline)', backgroundColor: 'var(--vault-bg)' }}>
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
                    )}
                </div>
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
