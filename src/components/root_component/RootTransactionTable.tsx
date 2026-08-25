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

    const columns: { label: string; field: keyof Transaction; align: 'left' | 'center' | 'right' }[] = [
        { label: 'ID', field: 'id', align: 'left' },
        { label: 'วันที่/เวลา', field: 'created_at', align: 'left' },
        { label: 'ประเภท', field: 'Transaction_Type', align: 'center' },
        { label: 'สกุลเงิน', field: 'Cur', align: 'center' },
        { label: 'จำนวน', field: 'Amount', align: 'right' },
        { label: 'เรต', field: 'Rate', align: 'right' },
        { label: 'รวม (THB)', field: 'Total_TH', align: 'right' },
        { label: 'พาสปอร์ต', field: 'Customer_Passport_no', align: 'left' },
        { label: 'สัญชาติ', field: 'Customer_Nationality', align: 'left' },
        { label: 'ลูกค้า', field: 'Customer_Name', align: 'left' },
        { label: 'ร้าน', field: 'Branch', align: 'left' },
    ]

    return (
        <div className="root-vault flex flex-col h-full rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)' }}>
            {/* Toolbar */}
            <div className="p-5 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center" style={{ borderBottom: '1px solid var(--vault-hairline)' }}>
                <div className="flex flex-col gap-1">
                    <h2 className="font-display text-lg font-semibold tracking-tight" style={{ color: 'var(--vault-paper)' }}>รายการทั้งหมด</h2>
                    <p className="text-sm font-figure" style={{ color: 'var(--vault-muted)' }}>
                        แสดง {filteredTransactions.length} รายการ
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                    {/* Search */}
                    <div className="relative group w-full sm:w-56">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4" style={{ color: 'var(--vault-muted)' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อ, พาสปอร์ต..."
                            className="pl-9 pr-4 py-2.5 w-full rounded-xl text-sm outline-none transition-all"
                            style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)', color: 'var(--vault-paper)' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Currency Filter */}
                    <select
                        className="px-4 py-2.5 rounded-xl text-sm outline-none transition-all cursor-pointer"
                        style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)', color: 'var(--vault-paper)' }}
                        value={currencyFilter}
                        onChange={(e) => setCurrencyFilter(e.target.value)}
                    >
                        <option value="">ทุกสกุลเงิน</option>
                        {uniqueCurrencies.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>

                    {/* Branch Filter */}
                    <select
                        className="px-4 py-2.5 rounded-xl text-sm font-medium outline-none transition-all cursor-pointer"
                        style={{ backgroundColor: 'var(--vault-brass-tint)', border: '1px solid var(--vault-brass-border)', color: 'var(--vault-brass)' }}
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                    >
                        <option value="">ทุกร้าน</option>
                        {uniqueBranches.map(b => (
                            <option key={b} value={b}>ร้าน {b}</option>
                        ))}
                    </select>

                    <button
                        onClick={onRefresh}
                        className="p-2.5 rounded-xl transition-all"
                        style={{ color: 'var(--vault-muted)', border: '1px solid var(--vault-hairline)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--vault-brass)'; e.currentTarget.style.borderColor = 'var(--vault-brass)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--vault-muted)'; e.currentTarget.style.borderColor = 'var(--vault-hairline)' }}
                        title="Refresh"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Filter Pills / Date Selection */}
            <div className="px-5 py-3 flex flex-wrap gap-2 items-center" style={{ borderBottom: '1px solid var(--vault-hairline)', backgroundColor: 'var(--vault-panel-raised)' }}>
                <span className="text-xs font-semibold uppercase tracking-wider mr-1" style={{ color: 'var(--vault-muted)' }}>วันที่:</span>
                <button
                    onClick={() => setSelectedDateFilter(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={!selectedDateFilter
                        ? { backgroundColor: 'var(--vault-brass)', color: 'var(--vault-brass-ink)' }
                        : { backgroundColor: 'var(--vault-panel-raised)', color: 'var(--vault-muted)', border: '1px solid var(--vault-hairline)' }}
                >
                    ทั้งหมด
                </button>
                {availableDates.map(date => {
                    const dateStr = date.toDateString()
                    const isSelected = selectedDateFilter === dateStr
                    const isToday = date.toDateString() === new Date().toDateString()

                    return (
                        <button
                            key={dateStr}
                            onClick={() => setSelectedDateFilter(isSelected ? null : dateStr)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium font-figure transition-all"
                            style={isSelected
                                ? { backgroundColor: 'var(--vault-brass)', color: 'var(--vault-brass-ink)' }
                                : { backgroundColor: 'var(--vault-panel-raised)', color: 'var(--vault-muted)', border: '1px solid var(--vault-hairline)' }}
                        >
                            {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric' })}
                            {isToday && <span className="ml-1 opacity-75">(วันนี้)</span>}
                        </button>
                    )
                })}
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="sticky top-0 z-10" style={{ backgroundColor: 'var(--vault-panel)', borderBottom: '1px solid var(--vault-hairline)' }}>
                            {columns.map((col) => (
                                <th
                                    key={col.label}
                                    className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wider cursor-pointer transition-colors ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                                    style={{ color: sortField === col.field ? 'var(--vault-brass)' : 'var(--vault-muted)' }}
                                    onClick={() => handleSort(col.field)}
                                >
                                    <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                                        {col.label}
                                        {sortField === col.field && (
                                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                            ))}
                            <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-right" style={{ color: 'var(--vault-muted)' }}>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={12} className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--vault-brass)', borderTopColor: 'transparent' }}></div>
                                        <p className="text-sm animate-pulse" style={{ color: 'var(--vault-muted)' }}>กำลังโหลดรายการ...</p>
                                    </div>
                                </td>
                            </tr>
                        ) : paginatedTransactions.length === 0 ? (
                            <tr>
                                <td colSpan={12} className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" style={{ color: 'var(--vault-hairline)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        <p className="font-medium" style={{ color: 'var(--vault-muted)' }}>ไม่พบรายการ</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedTransactions.map((transaction) => (
                                <tr
                                    key={transaction.id}
                                    className="transition-colors group"
                                    style={{ borderBottom: '1px solid var(--vault-hairline-soft)' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--vault-brass-faint)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-figure" style={{ color: 'var(--vault-muted)' }}>
                                        <span className="font-semibold" style={{ color: 'var(--vault-paper)' }}>#{transaction.id}</span>
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-figure">
                                        <span className="block font-medium" style={{ color: 'var(--vault-paper)' }}>{formatDate(transaction.created_at)}</span>
                                        <span className="block" style={{ color: 'var(--vault-muted)' }}>{formatTime(transaction.created_at)}</span>
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap text-center">
                                        <span
                                            className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full"
                                            style={transaction.Transaction_Type === 'Buying'
                                                ? { backgroundColor: 'rgba(79,174,129,0.15)', color: 'var(--vault-ink-credit)' }
                                                : { backgroundColor: 'rgba(224,101,74,0.15)', color: 'var(--vault-ink-debit)' }}
                                        >
                                            {transaction.Transaction_Type || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <img
                                                src={getFlagIcon(transaction.Cur || '')}
                                                alt={transaction.Cur || ''}
                                                className="w-5 h-5 object-contain rounded-full"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none'; // Hide if broken
                                                }}
                                            />
                                            <span className="font-bold font-figure" style={{ color: 'var(--vault-paper)' }}>{transaction.Cur}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap text-sm text-right font-figure" style={{ color: 'var(--vault-paper)' }}>
                                        {formatNumber(transaction.Amount)}
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap text-sm text-right font-figure" style={{ color: 'var(--vault-muted)' }}>
                                        {formatNumber(transaction.Rate)}
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap text-sm font-bold text-right font-figure" style={{ color: 'var(--vault-brass)' }}>
                                        {formatNumber(transaction.Total_TH)}
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap text-xs max-w-[120px] truncate font-figure" style={{ color: 'var(--vault-muted)' }} title={transaction.Customer_Passport_no || ''}>
                                        {transaction.Customer_Passport_no || '-'}
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-medium max-w-[150px] truncate" style={{ color: 'var(--vault-paper)' }} title={transaction.Customer_Nationality || ''}>
                                        {transaction.Customer_Nationality || '-'}
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-medium max-w-[150px] truncate" style={{ color: 'var(--vault-paper)' }} title={transaction.Customer_Name || ''}>
                                        {transaction.Customer_Name || '-'}
                                    </td>
                                    <td className="px-5 py-3.5 whitespace-nowrap text-xs max-w-[120px] truncate" style={{ color: 'var(--vault-muted)' }} title={transaction.Branch || ''}>
                                        {transaction.Branch || '-'}
                                    </td>

                                    {/* Action Buttons */}
                                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onEditTransaction(transaction)
                                                }}
                                                className="p-1.5 rounded-lg transition-all"
                                                style={{ color: 'var(--vault-branch-blue)' }}
                                                title="แก้ไข"
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
                                                    className="p-1.5 rounded-lg transition-all"
                                                    style={{ color: 'var(--vault-ink-debit)' }}
                                                    title="ลบ"
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
            <div className="px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4" style={{ borderTop: '1px solid var(--vault-hairline)', backgroundColor: 'var(--vault-panel-raised)' }}>
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-figure" style={{ color: 'var(--vault-muted)' }}>
                        รวม: <span className="font-semibold" style={{ color: 'var(--vault-brass)' }}>{formatNumber(totalAmountTHB)} THB</span>
                    </span>
                    <span className="text-xs font-figure" style={{ color: 'var(--vault-muted)' }}>{totalTransactions} รายการ</span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        style={{ border: '1px solid var(--vault-hairline)', color: 'var(--vault-muted)' }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        style={{ border: '1px solid var(--vault-hairline)', color: 'var(--vault-muted)' }}
                    >
                        ก่อนหน้า
                    </button>

                    <span className="text-sm font-medium font-figure px-2" style={{ color: 'var(--vault-paper)' }}>
                        {currentPage} / {Math.max(totalPages, 1)}
                    </span>

                    <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        style={{ border: '1px solid var(--vault-hairline)', color: 'var(--vault-muted)' }}
                    >
                        ถัดไป
                    </button>
                    <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="p-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        style={{ border: '1px solid var(--vault-hairline)', color: 'var(--vault-muted)' }}
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
