import { useState, useEffect } from 'react'
import { getTransactions, updateTransaction, deleteTransaction } from '../lib/api'
import type { Transaction } from '../utils/currencyUtils'
import RootTransactionTable from './root_component/RootTransactionTable'
import TransactionForm from './system_component/TransactionForm'
// Imports removed
import Toast from './system_component/Toast'
import { calculateExchangeTotal } from '../utils/currencyUtils'
import ClientTimeAnalytics from './root_component/ClientTimeAnalytics'

export default function RootPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
    const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null) // Default to All (within range)

    // Toast state
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

    // Generate last 10 days
    const availableDates = Array.from({ length: 10 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (9 - i)) // -9, ..., 0 (Today)
        return d
    }).reverse() // Today first

    useEffect(() => {
        fetchTransactions()
    }, [])

    const fetchTransactions = async () => {
        setLoading(true)
        try {
            // Calculate date 10 days ago
            const d = new Date()
            d.setDate(d.getDate() - 10)
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

    // --- Search/Filter Logic (Client-side for now, as we fetch 10 days) ---
    // TransactionTable handles some filtering, but we can pass props if needed.
    // For now, we rely on TransactionTable's internal search and the Date Badges.
    // We pass `availableDates` (10 days) to TransactionTable.

    const filteredTransactions = transactions.filter(transaction => {
        if (!transaction.created_at) return false

        if (selectedDateFilter) {
            const transactionDate = new Date(transaction.created_at).toDateString()
            return transactionDate === selectedDateFilter
        }



        return true
    })




    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <img src="/Ex_logo_6.png" alt="Logo" className="h-10 w-auto" />
                    <h1 className="text-xl font-bold text-gray-800">Root Transaction Manager</h1>
                </div>
                <div className="flex items-center gap-4">
                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">ROOT ACCESS</span>
                </div>
            </div>

            <div className="flex-1 p-6 w-full mx-auto space-y-6">

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-[600px] max-w-full max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">Edit Transaction</h2>
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
    )
}
