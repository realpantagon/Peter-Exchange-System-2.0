import { useState, useEffect } from 'react'
import type { Transaction } from '../../utils/currencyUtils'
import { getFlagIcon } from '../../utils/currencyUtils'

interface TransactionTableProps {
    transactions: Transaction[]
    loading: boolean
    onRefresh: () => void
    branchId?: string | null
    selectedDateFilter: string | null
    setSelectedDateFilter: (date: string | null) => void
    availableDates: Date[]
    dateFrom: string
    setDateFrom: (date: string) => void
    dateTo: string
    setDateTo: (date: string) => void
    onEditTransaction: (transaction: Transaction) => void
    onDeleteTransaction?: (transaction: Transaction) => void
    selectedTransactionIds: number[]
    onToggleSelect: (id: number) => void
    onPrintSingle: (transaction: Transaction) => void
    onSelectAll: (ids: number[]) => void
    onCustomizeReceipt: () => void
    onPrintSelected: () => void
    onClearSelection: () => void
    selectedCount: number
    selectedTotal: number
}

export default function TransactionTable({
    transactions,
    loading,
    onRefresh,
    branchId,
    selectedDateFilter,
    setSelectedDateFilter,
    availableDates,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    onEditTransaction,
    onDeleteTransaction,
    selectedTransactionIds = [],
    onToggleSelect,
    onPrintSingle,
    onSelectAll,
    onCustomizeReceipt,
    onPrintSelected,
    onClearSelection,
    selectedCount,
    selectedTotal
}: TransactionTableProps) {
    const [sortField, setSortField] = useState<keyof Transaction>('created_at')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
    const [searchTerm, setSearchTerm] = useState('')
    const [currencyFilter, setCurrencyFilter] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    const handleSort = (field: keyof Transaction) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('asc')
        }
    }

    // Filter transactions based on search term and currency filter
    const filteredTransactions = transactions.filter((transaction) => {
        const searchTermLower = searchTerm.toLowerCase()
        const matchesSearch = !searchTerm ||
            (transaction.Cur || '').toLowerCase().includes(searchTermLower) ||
            (transaction.Branch || '').toLowerCase().includes(searchTermLower) ||
            (transaction.Transaction_Type || '').toLowerCase().includes(searchTermLower) ||
            (transaction.Customer_Name || '').toLowerCase().includes(searchTermLower) ||
            (transaction.Customer_Passport_no || '').toLowerCase().includes(searchTermLower) ||
            (transaction.Amount || '').includes(searchTerm) ||
            (transaction.Rate || '').includes(searchTerm) ||
            (transaction.Total_TH || '').includes(searchTerm) ||
            (transaction.id || '').toString().includes(searchTerm)

        const matchesCurrency = !currencyFilter || transaction.Cur === currencyFilter

        return matchesSearch && matchesCurrency
    })

    const sortedTransactions = [...filteredTransactions].sort((a, b) => {
        const aValue = a[sortField] || ''
        const bValue = b[sortField] || ''

        if (aValue === '' && bValue === '') return 0
        if (aValue === '') return 1
        if (bValue === '') return -1

        let comparison = 0
        if (aValue < bValue) comparison = -1
        if (aValue > bValue) comparison = 1

        return sortDirection === 'desc' ? comparison * -1 : comparison
    })

    // Pagination calculations
    const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedTransactions = sortedTransactions.slice(startIndex, endIndex)

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, currencyFilter, sortField, sortDirection])

    const goToPage = (page: number) => {
        setCurrentPage(Math.max(1, Math.min(page, totalPages)))
    }

    // Get unique currencies for filter dropdown
    const uniqueCurrencies = [...new Set(transactions.map(t => t.Cur || ''))].filter(Boolean).sort()

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A'
        return new Date(dateString).toLocaleString()
    }

    const formatCurrency = (amount: string | null) => {
        return parseFloat(amount || '0').toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })
    }

    const formatRate = (rate: string | null) => {
        // Display rate with full precision (no decimal limit)
        return parseFloat(rate || '0').toString()
    }

    const SortIcon = ({ field }: { field: keyof Transaction }) => {
        if (sortField !== field) {
            return (
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
            )
        }

        return sortDirection === 'asc' ? (
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
        ) : (
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        )
    }

    if (loading) {
        return (
            <div className="w-4/5 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading transactions...</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="w-4/5 bg-white rounded-xl shadow-lg border-2 border-gray-200">
            {/* Header */}
            <div className="p-6 border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Transactions</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            {branchId ? `Branch: ${branchId} • ` : ''}
                            {sortedTransactions.length} total {sortedTransactions.length === 1 ? 'transaction' : 'transactions'}
                            {totalPages > 1 && ` • Page ${currentPage} of ${totalPages}`}
                        </p>
                    </div>

                    <img src="Ex_logo_6.png" alt="App Icon" className="h-12 mb-2" />

                </div>

                {/* Search and Filter Controls */}
                <div className="space-y-4">
                    {/* Date Filter */}
                    {/* Date Filter Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {availableDates.map((date) => {
                            const dateStr = date.toDateString()
                            const isSelected = selectedDateFilter === dateStr
                            const isToday = new Date().toDateString() === dateStr
                            const label = `${date.getDate()}/${date.getMonth() + 1}${isToday ? ' (Today)' : ''}`

                            return (
                                <button
                                    key={dateStr}
                                    onClick={() => setSelectedDateFilter(isSelected ? null : dateStr)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border transform active:scale-95 ${isSelected
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    {label}
                                </button>
                            )
                        })}

                        {/* Custom Range Filter (Only show if no badge selected or specifically toggled? Keeping it simple for now) */}
                        {!selectedDateFilter && (
                            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-300">
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="px-2 py-1.5 border-2 border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                    placeholder="From"
                                />
                                <span className="text-gray-400 text-xs">-</span>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="px-2 py-1.5 border-2 border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                    placeholder="To"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between">
                        <div className="flex items-center gap-4">
                            {/* Search Input */}
                            <div className="relative flex-1 max-w-md">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search transactions..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2.5 border-2 border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all duration-200 hover:border-gray-400"
                                />
                            </div>

                            {/* Currency Filter */}
                            <div className="relative">
                                <select
                                    value={currencyFilter}
                                    onChange={(e) => setCurrencyFilter(e.target.value)}
                                    className="block px-4 py-2.5 pr-10 border-2 border-gray-300 rounded-lg leading-5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none cursor-pointer transition-all duration-200 hover:border-gray-400 font-medium"
                                >
                                    <option value="">All Currencies</option>
                                    {uniqueCurrencies.map((currency) => (
                                        <option key={currency} value={currency}>
                                            {currency}
                                        </option>
                                    ))}
                                </select>
                                {currencyFilter && (
                                    <img
                                        src={getFlagIcon(currencyFilter)}
                                        alt={`${currencyFilter} flag`}
                                        className="absolute right-8 top-1/2 transform -translate-y-1/2 w-4 h-4 rounded-full object-cover pointer-events-none"
                                        onError={(e) => {
                                            e.currentTarget.src = '/vite.svg'
                                        }}
                                    />
                                )}
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>

                            {/* Clear Filters Button */}
                            {(searchTerm || currencyFilter) && (
                                <button
                                    onClick={() => {
                                        setSearchTerm('')
                                        setCurrencyFilter('')
                                    }}
                                    className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 cursor-pointer active:scale-95"
                                >
                                    Clear Filters
                                </button>
                            )}
                            {/* Customize Receipt Button */}
                            <button
                                onClick={onCustomizeReceipt}
                                className="px-4 py-2.5 text-gray-700 bg-white hover:bg-gray-100 rounded-lg font-bold shadow-sm hover:shadow-md transition-all active:scale-95 border-2 border-gray-300 outline-none flex items-center gap-2 whitespace-nowrap"
                                title="Customize Receipt"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>Customize</span>
                            </button>

                            {/* Selection Controls */}
                            {selectedCount > 0 && (
                                <div className="flex items-center gap-3 animate-fadeIn ml-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-blue-600">{selectedCount} Selected</span>
                                        <span className="text-[10px] text-gray-500 font-medium">Sum: ฿{selectedTotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={onPrintSelected}
                                            className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm transition-all active:scale-95 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                                            title="Print Selected"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2-4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                            </svg>
                                            Print ({selectedCount})
                                        </button>
                                        <button
                                            onClick={onClearSelection}
                                            className="p-2 bg-white text-orange-500 border border-orange-200 rounded-md hover:bg-orange-50 transition-all active:scale-95"
                                            title="Clear Selection"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            )}

                        </div>
                        <button
                            onClick={onRefresh}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-95 font-medium cursor-pointer"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                {sortedTransactions.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="text-gray-400 mb-4">
                            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {transactions.length === 0 ? 'No transactions found' : 'No matching transactions'}
                        </h3>
                        <p className="text-gray-600">
                            {transactions.length === 0
                                ? (branchId ? `No transactions found for branch ${branchId}` : 'No transactions have been created yet')
                                : 'Try adjusting your search or filter criteria'
                            }
                        </p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gradient-to-r from-gray-100 to-gray-50">
                            <tr>
                                <th
                                    className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors duration-150 border-b-2 border-gray-200"
                                    onClick={() => handleSort('id')}
                                >
                                    <div className="flex items-center gap-2">
                                        ID
                                        <SortIcon field="id" />
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200 w-10">
                                    <span className="sr-only">Select</span>
                                    <input
                                        type="checkbox"
                                        checked={paginatedTransactions.length > 0 && paginatedTransactions.every(t => t.id && selectedTransactionIds.includes(t.id))}
                                        onChange={() => {
                                            const idsToSelect = paginatedTransactions.map(t => t.id).filter((id): id is number => id !== undefined)
                                            onSelectAll(idsToSelect)
                                        }}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                    />
                                </th>
                                <th
                                    className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors duration-150 border-b-2 border-gray-200"
                                    onClick={() => handleSort('created_at')}
                                >
                                    <div className="flex items-center gap-2">
                                        Date/Time
                                        <SortIcon field="created_at" />
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors duration-150 border-b-2 border-gray-200"
                                    onClick={() => handleSort('Transaction_Type')}
                                >
                                    <div className="flex items-center gap-2">
                                        Type
                                        <SortIcon field="Transaction_Type" />
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors duration-150 border-b-2 border-gray-200"
                                    onClick={() => handleSort('Cur')}
                                >
                                    <div className="flex items-center gap-2">
                                        Currency
                                        <SortIcon field="Cur" />
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors duration-150 border-b-2 border-gray-200"
                                    onClick={() => handleSort('Amount')}
                                >
                                    <div className="flex items-center gap-2">
                                        Amount
                                        <SortIcon field="Amount" />
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors duration-150 border-b-2 border-gray-200"
                                    onClick={() => handleSort('Rate')}
                                >
                                    <div className="flex items-center gap-2">
                                        Rate
                                        <SortIcon field="Rate" />
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors duration-150 border-b-2 border-gray-200"
                                    onClick={() => handleSort('Total_TH')}
                                >
                                    <div className="flex items-center gap-2">
                                        Total THB
                                        <SortIcon field="Total_TH" />
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200">
                                    Passport No.
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200">
                                    Nationality
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200">
                                    Name
                                </th>
                                {!branchId && (
                                    <>
                                        <th
                                            className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider cursor:pointer hover:bg-gray-200 transition-colors duration-150 border-b-2 border-gray-200"
                                            onClick={() => handleSort('Branch')}
                                        >
                                            <div className="flex items-center gap-2">
                                                Branch
                                                <SortIcon field="Branch" />
                                            </div>
                                        </th>
                                    </>
                                )}
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y-0 divide-gray-100">
                            {paginatedTransactions.map((transaction, index) => (
                                <tr key={transaction.id || index} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-150 cursor-pointer">
                                    <td className="px-6 py-0 whitespace-nowrap text-sm font-bold text-gray-900">
                                        #{transaction.id}
                                    </td>
                                    <td className="px-6 py-0 whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={selectedTransactionIds.includes(transaction.id!)}
                                            onChange={(e) => {
                                                e.stopPropagation()
                                                if (transaction.id) onToggleSelect(transaction.id)
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                        />
                                    </td>
                                    <td className="px-6 py-0 whitespace-nowrap text-sm text-gray-600 font-medium">
                                        {formatDate(transaction.created_at)}
                                    </td>
                                    <td className="px-6 py-0 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${transaction.Transaction_Type === 'Buying'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-orange-100 text-orange-800'
                                            }`}>
                                            {transaction.Transaction_Type || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-0 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <img
                                                src={getFlagIcon(transaction.Cur || '')}
                                                alt={`${transaction.Cur} flag`}
                                                className="w-5 h-5 rounded-full object-cover"
                                                onError={(e) => {
                                                    e.currentTarget.src = '/vite.svg'
                                                }}
                                            />
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                {transaction.Cur}
                                            </span>
                                        </div>
                                    </td>
                                    <td className={`px-6 py-0 whitespace-nowrap text-sm font-semibold rounded ${transaction.Transaction_Type === 'Selling'
                                        ? 'text-orange-700 bg-orange-50'
                                        : 'text-green-700 bg-green-50'
                                        }`}>
                                        {formatCurrency(transaction.Amount)}
                                    </td>
                                    <td className="px-6 py-0 whitespace-nowrap text-sm text-gray-900 font-semibold">
                                        {formatRate(transaction.Rate)}
                                    </td>
                                    <td className={`px-6 py-0 whitespace-nowrap text-sm font-bold rounded ${transaction.Transaction_Type === 'Selling'
                                        ? 'text-orange-700 bg-orange-50'
                                        : 'text-green-700 bg-green-50'
                                        }`}>
                                        ฿{formatCurrency(transaction.Total_TH)}
                                    </td>
                                    <td className="px-6 py-0 whitespace-nowrap text-sm text-gray-600">
                                        {transaction.Customer_Passport_no || '-'}
                                    </td>
                                    <td className="px-6 py-0 whitespace-nowrap text-sm text-gray-600">
                                        {transaction.Customer_Nationality || '-'}
                                    </td>
                                    <td className="px-6 py-0 whitespace-nowrap text-sm text-gray-600">
                                        {transaction.Customer_Name || '-'}
                                    </td>
                                    {!branchId && (
                                        <td className="px-6 py-0 whitespace-nowrap text-sm text-gray-600 font-medium">
                                            {transaction.Branch || 'N/A'}
                                        </td>
                                    )}
                                    <td className="px-6 py-3 whitespace-nowrap text-sm">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onEditTransaction(transaction)
                                            }}
                                            className="text-blue-600 hover:text-blue-800 transition-all duration-150 cursor-pointer hover:bg-blue-50 p-1.5 rounded-full ring-1 ring-blue-200"
                                            title="Edit Transaction"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onPrintSingle(transaction)
                                            }}
                                            className="ml-2 text-purple-600 hover:text-purple-800 transition-all duration-150 cursor-pointer hover:bg-purple-100 p-1.5 rounded-full ring-1 ring-purple-200"
                                            title="Print Receipt"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2-4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                            </svg>
                                        </button>
                                        {onDeleteTransaction && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onDeleteTransaction(transaction)
                                                }}
                                                className="ml-2 text-red-600 hover:text-red-800 transition-all duration-150 cursor-pointer hover:bg-red-100 p-1.5 rounded-full ring-1 ring-red-200"
                                                title="Delete Transaction"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )
                }
            </div >

            {/* Footer */}
            {
                sortedTransactions.length > 0 && (
                    <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-t-2 border-gray-200">
                        {/* Summary Statistics - New Section */}
                        <div className={`mb-4 grid ${searchTerm || currencyFilter ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                            {(searchTerm || currencyFilter) && (
                                <div className="bg-blue-50 px-4 py-3 rounded-lg border-2 border-blue-200">
                                    <div className="text-xs text-blue-600 font-semibold uppercase mb-1">Total Amount (Filtered)</div>
                                    <div className="text-2xl font-bold text-blue-700">
                                        {sortedTransactions.reduce((sum, t) => sum + parseFloat(t.Amount || '0'), 0).toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}
                                    </div>
                                </div>
                            )}
                            <div className="bg-green-50 px-4 py-3 rounded-lg border-2 border-green-200">
                                <div className="text-xs text-green-600 font-semibold uppercase mb-1">Net Total (THB)</div>
                                <div className="text-2xl font-bold text-green-700">
                                    ฿{sortedTransactions.reduce((sum, t) => sum + parseFloat(t.Total_TH || '0'), 0).toLocaleString('en-US', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            {/* Pagination Info */}
                            <div className="text-sm font-medium text-gray-700">
                                Showing <span className="font-bold text-blue-600">{startIndex + 1}</span> to <span className="font-bold text-blue-600">{Math.min(endIndex, sortedTransactions.length)}</span> of <span className="font-bold text-blue-600">{sortedTransactions.length}</span> transactions
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => goToPage(1)}
                                        disabled={currentPage === 1}
                                        className="px-4 py-2 text-sm font-medium border-2 border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer hover:border-gray-400 active:scale-95"
                                    >
                                        First
                                    </button>
                                    <button
                                        onClick={() => goToPage(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="px-4 py-2 text-sm font-medium border-2 border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer hover:border-gray-400 active:scale-95"
                                    >
                                        Previous
                                    </button>

                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum
                                            if (totalPages <= 5) {
                                                pageNum = i + 1
                                            } else if (currentPage <= 3) {
                                                pageNum = i + 1
                                            } else if (currentPage >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i
                                            } else {
                                                pageNum = currentPage - 2 + i
                                            }

                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => goToPage(pageNum)}
                                                    className={`px-4 py-2 text-sm font-bold border-2 rounded-lg transition-all duration-150 cursor-pointer active:scale-95 ${currentPage === pageNum
                                                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-600 shadow-md'
                                                        : 'border-gray-300 hover:bg-gray-100 hover:border-gray-400'
                                                        }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            )
                                        })}
                                    </div>

                                    <button
                                        onClick={() => goToPage(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="px-4 py-2 text-sm font-medium border-2 border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer hover:border-gray-400 active:scale-95"
                                    >
                                        Next
                                    </button>
                                    <button
                                        onClick={() => goToPage(totalPages)}
                                        disabled={currentPage === totalPages}
                                        className="px-4 py-2 text-sm font-medium border-2 border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer hover:border-gray-400 active:scale-95"
                                    >
                                        Last
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    )
}