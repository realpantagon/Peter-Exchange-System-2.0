import { useState, useEffect } from 'react'
import type { Transaction } from '../../utils/currencyUtils'
import { getFlagIcon } from '../../utils/currencyUtils'

interface RootTransactionTableProps {
    transactions: Transaction[]
    loading: boolean
    onRefresh: () => void
    selectedDateFilter: string | null
    setSelectedDateFilter: (date: string | null) => void
    availableDates: Date[]
    onEditTransaction: (transaction: Transaction) => void
    onDeleteTransaction?: (transaction: Transaction) => void
}

export default function RootTransactionTable({
    transactions,
    loading,
    onRefresh,
    selectedDateFilter,
    setSelectedDateFilter,
    availableDates,
    onEditTransaction,
    onDeleteTransaction,
}: RootTransactionTableProps) {
    const [sortField, setSortField] = useState<keyof Transaction>('created_at')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
    const [searchTerm, setSearchTerm] = useState('')
    const [currencyFilter, setCurrencyFilter] = useState('')
    const [branchFilter, setBranchFilter] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, currencyFilter, branchFilter, selectedDateFilter])

    const handleSort = (field: keyof Transaction) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('desc')
        }
    }

    const filteredTransactions = transactions.filter(transaction => {
        // Search Logic
        const searchLower = searchTerm.toLowerCase()
        const matchesSearch =
            (transaction.id?.toString() || '').includes(searchLower) ||
            (transaction.Customer_Name || '').toLowerCase().includes(searchLower) ||
            (transaction.Customer_Passport_no || '').toLowerCase().includes(searchLower) ||
            (transaction.Transaction_Type || '').toLowerCase().includes(searchLower) ||
            (transaction.Cur || '').toLowerCase().includes(searchLower)

        // Currency Filter
        const matchesCurrency = currencyFilter ? transaction.Cur === currencyFilter : true

        // Branch Filter
        const matchesBranch = branchFilter ? transaction.Branch === branchFilter : true

        return matchesSearch && matchesCurrency && matchesBranch
    })

    const sortedTransactions = [...filteredTransactions].sort((a, b) => {
        const aValue = a[sortField]
        const bValue = b[sortField]

        if (!aValue && !bValue) return 0
        if (!aValue) return 1
        if (!bValue) return -1

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
        return 0
    })

    const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage)
    const paginatedTransactions = sortedTransactions.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    // Calculate Totals
    const totalTransactions = filteredTransactions.length
    const totalAmountTHB = filteredTransactions.reduce((sum, t) => {
        const val = parseFloat((t.Total_TH || '0').replace(/,/g, ''))
        return sum + (isNaN(val) ? 0 : val)
    }, 0)

    const uniqueCurrencies = Array.from(new Set(transactions.map(t => t.Cur).filter(Boolean))) as string[]
    const uniqueBranches = Array.from(new Set(transactions.map(t => t.Branch).filter(Boolean))) as string[]

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return 'N/A'
        return new Date(dateString).toLocaleDateString('en-GB', {
            timeZone: 'Asia/Bangkok',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
    }

    const formatTime = (dateString: string | undefined) => {
        if (!dateString) return ''
        return new Date(dateString).toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Bangkok',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })
    }

    const formatNumber = (num: string | number | undefined | null) => {
        if (num === undefined || num === null || num === '') return '0.00'
        const n = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : num
        return isNaN(n) ? '0.00' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }

    return (
        <div className="flex flex-col h-full bg-white/50 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-100/50 overflow-hidden">
            {/* Toolbar */}
            <div className="p-5 border-b border-gray-100 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-white/80">
                <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-bold text-gray-800 tracking-tight">Recent Transactions</h2>
                    <p className="text-sm text-gray-500 font-medium">
                        Showing {filteredTransactions.length} results
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                    {/* Search */}
                    <div className="relative group w-full sm:w-56">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search Name, Passport..."
                            className="pl-10 pr-4 py-2.5 w-full border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm outline-none bg-gray-50/50 focus:bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Currency Filter */}
                    <select
                        className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm outline-none bg-gray-50/50 focus:bg-white cursor-pointer hover:bg-gray-50 bg-none"
                        value={currencyFilter}
                        onChange={(e) => setCurrencyFilter(e.target.value)}
                    >
                        <option value="">All Currencies</option>
                        {uniqueCurrencies.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>

                    {/* Branch Filter Card */}
                    <div className="relative">
                        <select
                            className="pl-4 pr-10 py-2.5 border border-purple-200 rounded-xl text-sm font-medium text-purple-700 bg-purple-50 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all shadow-sm outline-none appearance-none cursor-pointer hover:bg-purple-100"
                            value={branchFilter}
                            onChange={(e) => setBranchFilter(e.target.value)}
                        >
                            <option value="">All Branches</option>
                            {uniqueBranches.map(b => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-purple-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>

                    <button
                        onClick={onRefresh}
                        className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-gray-200 hover:border-blue-200 shadow-sm"
                        title="Refresh"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Filter Pills / Date Selection */}
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/30 flex flex-wrap gap-2 items-center">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-2">Filter Date:</span>
                <button
                    onClick={() => setSelectedDateFilter(null)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!selectedDateFilter ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                >
                    All Days
                </button>
                {availableDates.map(date => {
                    const dateStr = date.toDateString()
                    const isSelected = selectedDateFilter === dateStr
                    const isToday = date.toDateString() === new Date().toDateString()

                    return (
                        <button
                            key={dateStr}
                            onClick={() => setSelectedDateFilter(isSelected ? null : dateStr)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isSelected
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric' })}
                            {isToday && <span className="ml-1 opacity-75">(Today)</span>}
                        </button>
                    )
                })}
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm border-b border-gray-200">
                            {[
                                { label: 'ID', field: 'id', align: 'left' },
                                { label: 'Date/Time', field: 'created_at', align: 'left' },
                                { label: 'Type', field: 'Transaction_Type', align: 'center' },
                                { label: 'Currency', field: 'Cur', align: 'center' },
                                { label: 'Amount', field: 'Amount', align: 'right' },
                                { label: 'Rate', field: 'Rate', align: 'right' },
                                { label: 'Total (THB)', field: 'Total_TH', align: 'right' },
                                { label: 'Passport', field: 'Customer_Passport_no', align: 'left' },
                                { label: 'Nationality', field: 'Customer_Nationality', align: 'left' },
                                { label: 'Customer', field: 'Customer_Name', align: 'left' },
                                { label: 'Branch', field: 'Branch', align: 'left' },
                            ].map((col) => (
                                <th
                                    key={col.label}
                                    className={`px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors text-${col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left'}`}
                                    onClick={() => handleSort(col.field as keyof Transaction)}
                                >
                                    <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                                        {col.label}
                                        {sortField === col.field && (
                                            <span className="text-blue-500">
                                                {sortDirection === 'asc' ? '↑' : '↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan={10} className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-gray-400 text-sm animate-pulse">Loading transactions...</p>
                                    </div>
                                </td>
                            </tr>
                        ) : paginatedTransactions.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        <p className="text-gray-400 font-medium">No transactions found</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedTransactions.map((transaction) => (
                                <tr
                                    key={transaction.id}
                                    className="hover:bg-blue-50/50 transition-colors group"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                                        <span className="font-semibold text-gray-700">#{transaction.id}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                                        <span className="font-semibold text-gray-700">{formatDate(transaction.created_at)}</span>
                                        <span className="block font-semibold text-gray-700">{formatTime(transaction.created_at)}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${transaction.Transaction_Type === 'Buying'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                            : 'bg-rose-50 text-rose-700 border-rose-100'
                                            }`}>
                                            {transaction.Transaction_Type || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <img
                                                src={getFlagIcon(transaction.Cur || '')}
                                                alt={transaction.Cur || ''}
                                                className="w-5 h-5 object-contain rounded-full shadow-sm"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none'; // Hide if broken
                                                }}
                                            />
                                            <span className="font-bold text-gray-700">{transaction.Cur}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700 text-right font-mono">
                                        {formatNumber(transaction.Amount)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-mono">
                                        {formatNumber(transaction.Rate)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right font-mono">
                                        {formatNumber(transaction.Total_TH)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 max-w-[120px] truncate" title={transaction.Customer_Passport_no || ''}>
                                        {transaction.Customer_Passport_no || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600 font-medium max-w-[150px] truncate" title={transaction.Customer_Nationality || ''}>
                                        {transaction.Customer_Nationality || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600 font-medium max-w-[150px] truncate" title={transaction.Customer_Name || ''}>
                                        {transaction.Customer_Name || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 max-w-[120px] truncate" title={transaction.Branch || ''}>
                                        {transaction.Branch || '-'}
                                    </td>

                                    {/* Action Buttons */}
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onEditTransaction(transaction)
                                                }}
                                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-all"
                                                title="Edit"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>

                                            {onDeleteTransaction && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        onDeleteTransaction(transaction)
                                                    }}
                                                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-lg transition-all"
                                                    title="Delete"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination & Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50">
                <div className="flex flex-col gap-1">
                    <span className="text-sm text-gray-600 font-medium">Total: <span className="text-gray-900">{formatNumber(totalAmountTHB)} THB</span></span>
                    <span className="text-xs text-gray-400">{totalTransactions} transactions found</span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Previous
                    </button>

                    <span className="text-sm font-medium text-gray-700 px-2">
                        Page {currentPage} of {Math.max(totalPages, 1)}
                    </span>

                    <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Next
                    </button>
                    <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    )
}
