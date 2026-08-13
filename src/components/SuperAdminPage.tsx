import { useState, useEffect, useMemo } from 'react'
// import { MOCK_TRANSACTIONS } from '../mocks/data'
import { getTransactions } from '../lib/api'
import type { Transaction } from '../utils/currencyUtils'
import { getFlagIcon } from '../utils/currencyUtils'

interface CurrencySummary {
    currency: string
    buyingAmount: number
    sellingAmount: number
    netAmount: number
    buyingTotalTHB: number
    sellingTotalTHB: number
    netTotalTHB: number
}

interface BranchSummary {
    branchId: string
    totalTransactions: number
    totalAmount: number
    netTotalTHB: number
    buyingCount: number
    sellingCount: number
    buyingTotal: number
    sellingTotal: number
    currencies: Map<string, CurrencySummary>
}

const CURRENCY_ORDER = ['USD', 'USD2', 'USD1', 'EUR', 'JPY', 'GBP', 'SGD', 'AUD', 'CHF', 'HKD', 'CAD', 'NZD', 'TWD', 'MYR', 'CNY', 'KRW']

const sortedCurrencies = (map: Map<string, CurrencySummary>) =>
    Array.from(map.values()).sort((a, b) => {
        const aIndex = CURRENCY_ORDER.indexOf(a.currency)
        const bIndex = CURRENCY_ORDER.indexOf(b.currency)
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
        if (aIndex !== -1) return -1
        if (bIndex !== -1) return 1
        return a.currency.localeCompare(b.currency)
    })

const formatCurrency = (amount: number) =>
    amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Pure aggregation — kept outside the component and driven by useMemo so it
// only recomputes when the input transactions actually change (a version
// that lived in useEffect + setState here recomputed `filteredTransactions`
// as a new array on every render, which retriggered the effect every time
// and caused an infinite render loop).
const computeBranchSummaries = (transactions: Transaction[]): BranchSummary[] => {
    const branchMap = new Map<string, BranchSummary>()

    transactions.forEach(transaction => {
        const branchId = transaction.Branch || 'Unknown'
        const currency = transaction.Cur || 'Unknown'
        const amount = parseFloat(transaction.Amount || '0')
        const totalTHB = parseFloat(transaction.Total_TH || '0')
        const isBuying = transaction.Transaction_Type === 'Buying'

        if (!branchMap.has(branchId)) {
            branchMap.set(branchId, {
                branchId,
                totalTransactions: 0,
                totalAmount: 0,
                netTotalTHB: 0,
                buyingCount: 0,
                sellingCount: 0,
                buyingTotal: 0,
                sellingTotal: 0,
                currencies: new Map<string, CurrencySummary>()
            })
        }

        const summary = branchMap.get(branchId)!
        summary.totalTransactions++
        summary.totalAmount += amount
        summary.netTotalTHB += totalTHB

        if (isBuying) {
            summary.buyingCount++
            summary.buyingTotal += totalTHB
        } else {
            summary.sellingCount++
            summary.sellingTotal += totalTHB
        }

        // Update currency summary
        if (!summary.currencies.has(currency)) {
            summary.currencies.set(currency, {
                currency,
                buyingAmount: 0,
                sellingAmount: 0,
                netAmount: 0,
                buyingTotalTHB: 0,
                sellingTotalTHB: 0,
                netTotalTHB: 0
            })
        }

        const currencySummary = summary.currencies.get(currency)!
        currencySummary.netAmount += amount
        currencySummary.netTotalTHB += totalTHB

        if (isBuying) {
            currencySummary.buyingAmount += amount
            currencySummary.buyingTotalTHB += totalTHB
        } else {
            currencySummary.sellingAmount += amount
            currencySummary.sellingTotalTHB += totalTHB
        }
    })

    return Array.from(branchMap.values()).sort((a, b) => a.branchId.localeCompare(b.branchId))
}

export default function SuperAdminPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    // Date filtering
    const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(new Date().toDateString()) // Default to Today
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')

    // Generate last 4 days including today
    const availableDates = Array.from({ length: 4 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (3 - i)) // -3, -2, -1, 0 (Today)
        return d
    }).reverse() // Today first

    // Filter transactions based on date settings
    const filteredTransactions = useMemo(() => transactions.filter(transaction => {
        if (!transaction.created_at) return false

        if (selectedDateFilter) {
            // Filter by specific selected date (from badges)
            const transactionDate = new Date(transaction.created_at).toDateString()
            return transactionDate === selectedDateFilter
        }

        if (dateFrom && dateTo) {
            const transactionDate = new Date(transaction.created_at)
            const fromDate = new Date(dateFrom)
            const toDate = new Date(dateTo)
            toDate.setHours(23, 59, 59, 999)
            return transactionDate >= fromDate && transactionDate <= toDate
        }

        return true
    }), [transactions, selectedDateFilter, dateFrom, dateTo])

    const branchSummaries = useMemo(() => computeBranchSummaries(filteredTransactions), [filteredTransactions])

    useEffect(() => {
        fetchTransactions()
    }, [])

    const fetchTransactions = async () => {
        setLoading(true)
        try {
            // Calculate date 3 days ago
            const date = new Date()
            date.setDate(date.getDate() - 3)
            const startDate = date.toISOString().split('T')[0] // Format YYYY-MM-DD

            const data = await getTransactions(startDate)
            setTransactions(data)
        } catch (error) {
            console.error("Failed to fetch transactions", error)
        }
        setLoading(false)
    }

    const grandTotal = branchSummaries.reduce((sum, branch) => sum + branch.netTotalTHB, 0)
    const totalBuyingTransactions = branchSummaries.reduce((sum, branch) => sum + branch.buyingCount, 0)
    const totalSellingTransactions = branchSummaries.reduce((sum, branch) => sum + branch.sellingCount, 0)
    const totalBuyingAmount = branchSummaries.reduce((sum, branch) => sum + branch.buyingTotal, 0)
    const totalSellingAmount = branchSummaries.reduce((sum, branch) => sum + branch.sellingTotal, 0)

    // Calculate overall currency summary across all branches
    const overallCurrencySummary = new Map<string, CurrencySummary>()
    branchSummaries.forEach(branch => {
        branch.currencies.forEach((currSummary, currency) => {
            if (!overallCurrencySummary.has(currency)) {
                overallCurrencySummary.set(currency, {
                    currency,
                    buyingAmount: 0,
                    sellingAmount: 0,
                    netAmount: 0,
                    buyingTotalTHB: 0,
                    sellingTotalTHB: 0,
                    netTotalTHB: 0
                })
            }
            const overall = overallCurrencySummary.get(currency)!
            overall.buyingAmount += currSummary.buyingAmount
            overall.sellingAmount += currSummary.sellingAmount
            overall.netAmount += currSummary.netAmount
            overall.buyingTotalTHB += currSummary.buyingTotalTHB
            overall.sellingTotalTHB += currSummary.sellingTotalTHB
            overall.netTotalTHB += currSummary.netTotalTHB
        })
    })

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading data...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-4 md:p-6 mb-4 md:mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <span className="hidden sm:flex w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 items-center justify-center shrink-0 shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </span>
                            <div>
                                <h1 className="text-xl md:text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
                                <p className="text-xs md:text-sm text-gray-500 mt-0.5">ภาพรวมทุกสาขา · All Branch Summary</p>
                            </div>
                        </div>
                        <img src="Ex_logo_6.png" alt="App Icon" className="h-12 md:h-16" />
                    </div>

                    {/* Date Filter */}
                    <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
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

                            {!selectedDateFilter && (
                                <div className="flex items-center gap-2 md:gap-4 flex-wrap ml-2 pl-2 border-l border-gray-300">
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="px-2 md:px-3 py-1.5 md:py-2 border-2 border-gray-300 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-blue-500 cursor-pointer flex-1 min-w-[120px]"
                                        placeholder="From Date"
                                    />
                                    <span className="text-gray-500 font-medium text-xs md:text-sm">to</span>
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="px-2 md:px-3 py-1.5 md:py-2 border-2 border-gray-300 rounded-lg text-xs md:text-sm focus:ring-2 focus:ring-blue-500 cursor-pointer flex-1 min-w-[120px]"
                                        placeholder="To Date"
                                    />
                                </div>
                            )}
                        </div>

                        <button
                            onClick={fetchTransactions}
                            className="md:ml-auto flex items-center justify-center gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg font-medium text-xs md:text-sm"
                        >
                            <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh
                        </button>
                    </div>
                </div>

                {filteredTransactions.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-12 text-center">
                        <div className="text-gray-300 mb-3">
                            <svg className="w-14 h-14 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">ไม่มีรายการในช่วงเวลานี้</h3>
                        <p className="text-sm text-gray-500">No transactions found for the selected date range</p>
                    </div>
                ) : (
                    <>
                        {/* Grand Total Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
                            <KpiCard
                                label="Total Branches"
                                value={branchSummaries.length.toString()}
                                accent="blue"
                                icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1" />}
                            />
                            <KpiCard
                                label="Buying Transactions"
                                value={totalBuyingTransactions.toString()}
                                sub={`฿${formatCurrency(totalBuyingAmount)}`}
                                accent="green"
                                icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4v16m0 0l-5-5m5 5l5-5" />}
                            />
                            <KpiCard
                                label="Selling Transactions"
                                value={totalSellingTransactions.toString()}
                                sub={`฿${formatCurrency(totalSellingAmount)}`}
                                accent="orange"
                                icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 20V4m0 0l-5 5m5-5l5 5" />}
                            />
                            <KpiCard
                                label="Grand Total (THB)"
                                value={`฿${formatCurrency(grandTotal)}`}
                                accent="blue"
                                icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />}
                            />
                        </div>

                        {/* Overall Currency Summary Table */}
                        <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 mb-4 md:mb-6">
                            <div className="p-4 md:p-6 border-b-2 border-gray-200 bg-gradient-to-r from-blue-50 to-white flex items-center gap-3">
                                <span className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18M9 17V9m4 8V5m4 12v-6" />
                                    </svg>
                                </span>
                                <div>
                                    <h2 className="text-lg md:text-2xl font-bold text-gray-900">สรุปทุกสาขา</h2>
                                    <p className="text-xs md:text-sm text-gray-500 mt-0.5">Overall currency summary, aggregated across all branches</p>
                                </div>
                            </div>
                            <CurrencyTable currencies={sortedCurrencies(overallCurrencySummary)} />
                        </div>

                        {/* Individual Branch Tables */}
                        <div className="space-y-4 md:space-y-6">
                            {branchSummaries.map((branch) => (
                                <div key={branch.branchId} className="bg-white rounded-xl shadow-lg border-2 border-gray-200">
                                    <div className="p-4 md:p-6 border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                                        <div className="flex items-center gap-3">
                                            <span className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 text-gray-700 font-bold flex items-center justify-center shrink-0 text-sm">
                                                {branch.branchId}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-lg md:text-xl font-bold text-gray-900">ร้าน {branch.branchId}</h3>
                                                <div className="flex flex-wrap gap-1.5 md:gap-2 mt-1.5">
                                                    <StatPill label="ทั้งหมด" value={`${branch.totalTransactions} รายการ`} tone="gray" />
                                                    <StatPill label="ซื้อ" value={`${branch.buyingCount} · ฿${formatCurrency(branch.buyingTotal)}`} tone="green" />
                                                    <StatPill label="ขาย" value={`${branch.sellingCount} · ฿${formatCurrency(branch.sellingTotal)}`} tone="orange" />
                                                    <StatPill label="สุทธิ" value={`฿${formatCurrency(branch.netTotalTHB)}`} tone="blue" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <CurrencyTable currencies={sortedCurrencies(branch.currencies)} />
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub, accent, icon }: {
    label: string
    value: string
    sub?: string
    accent: 'blue' | 'green' | 'orange'
    icon: React.ReactNode
}) {
    const palette = {
        blue: { border: 'border-blue-200', iconBg: 'bg-blue-100', iconText: 'text-blue-600', valueText: 'text-blue-700', labelText: 'text-blue-600' },
        green: { border: 'border-green-200', iconBg: 'bg-green-100', iconText: 'text-green-600', valueText: 'text-green-700', labelText: 'text-green-600' },
        orange: { border: 'border-orange-200', iconBg: 'bg-orange-100', iconText: 'text-orange-600', valueText: 'text-orange-700', labelText: 'text-orange-600' },
    }[accent]

    return (
        <div className={`bg-white rounded-lg shadow-md border-2 ${palette.border} p-3 md:p-4`}>
            <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-7 h-7 rounded-md ${palette.iconBg} flex items-center justify-center shrink-0`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${palette.iconText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {icon}
                    </svg>
                </span>
                <div className={`text-xs font-semibold uppercase ${palette.labelText}`}>{label}</div>
            </div>
            <div className={`text-xl md:text-3xl font-bold font-figure ${palette.valueText}`}>{value}</div>
            {sub && <div className={`text-xs md:text-sm mt-1 font-figure ${palette.labelText}`}>{sub}</div>}
        </div>
    )
}

function StatPill({ label, value, tone }: { label: string; value: string; tone: 'gray' | 'green' | 'orange' | 'blue' }) {
    const palette = {
        gray: 'bg-gray-100 text-gray-700',
        green: 'bg-green-100 text-green-700',
        orange: 'bg-orange-100 text-orange-700',
        blue: 'bg-blue-100 text-blue-700',
    }[tone]

    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold font-figure ${palette}`}>
            <span className="opacity-70 font-sans">{label}</span>
            {value}
        </span>
    )
}

// Shared table for both the "all branches" summary and each per-branch
// breakdown — grouped Buying / Selling / Net headers make the 6 numeric
// columns scannable, and only the THB figure (the number that matters) is
// bold/colored; the raw foreign-currency amount stays muted secondary info.
function CurrencyTable({ currencies }: { currencies: CurrencySummary[] }) {
    if (currencies.length === 0) {
        return <div className="px-6 py-10 text-center text-sm text-gray-400">ไม่มีข้อมูลสกุลเงิน</div>
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
                <thead>
                    <tr className="bg-gray-50">
                        <th rowSpan={2} className="px-3 md:px-5 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200 align-bottom">
                            สกุลเงิน
                        </th>
                        <th colSpan={2} className="px-3 md:px-5 py-2 text-center text-xs font-bold text-green-700 uppercase tracking-wider border-b border-l border-gray-200 bg-green-50/70">
                            ซื้อ
                        </th>
                        <th colSpan={2} className="px-3 md:px-5 py-2 text-center text-xs font-bold text-orange-700 uppercase tracking-wider border-b border-l border-gray-200 bg-orange-50/70">
                            ขาย
                        </th>
                        <th colSpan={2} className="px-3 md:px-5 py-2 text-center text-xs font-bold text-blue-700 uppercase tracking-wider border-b border-l border-gray-200 bg-blue-50/70">
                            สุทธิ
                        </th>
                    </tr>
                    <tr className="bg-gray-50">
                        <th className="px-3 md:px-5 py-2 text-right text-[11px] font-semibold text-gray-400 border-b border-l border-gray-200">จำนวน</th>
                        <th className="px-3 md:px-5 py-2 text-right text-[11px] font-semibold text-green-700 border-b border-gray-200">THB</th>
                        <th className="px-3 md:px-5 py-2 text-right text-[11px] font-semibold text-gray-400 border-b border-l border-gray-200">จำนวน</th>
                        <th className="px-3 md:px-5 py-2 text-right text-[11px] font-semibold text-orange-700 border-b border-gray-200">THB</th>
                        <th className="px-3 md:px-5 py-2 text-right text-[11px] font-semibold text-gray-400 border-b border-l border-gray-200">จำนวน</th>
                        <th className="px-3 md:px-5 py-2 text-right text-[11px] font-semibold text-blue-700 border-b border-gray-200">THB</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {currencies.map((curr) => (
                        <tr key={curr.currency} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 md:px-5 py-2.5 md:py-3 whitespace-nowrap">
                                <span className="inline-flex items-center gap-2">
                                    <img
                                        src={getFlagIcon(curr.currency)}
                                        alt={`${curr.currency} flag`}
                                        className="w-5 h-5 md:w-6 md:h-6 rounded-full border border-gray-100 object-cover shrink-0"
                                        onError={(e) => { e.currentTarget.src = '/vite.svg' }}
                                    />
                                    <span className="font-bold text-gray-900">{curr.currency}</span>
                                </span>
                            </td>
                            <td className="px-3 md:px-5 py-2.5 md:py-3 text-right font-figure text-gray-400 border-l border-gray-100">{formatCurrency(curr.buyingAmount)}</td>
                            <td className="px-3 md:px-5 py-2.5 md:py-3 text-right font-figure font-bold text-green-700">฿{formatCurrency(curr.buyingTotalTHB)}</td>
                            <td className="px-3 md:px-5 py-2.5 md:py-3 text-right font-figure text-gray-400 border-l border-gray-100">{formatCurrency(curr.sellingAmount)}</td>
                            <td className="px-3 md:px-5 py-2.5 md:py-3 text-right font-figure font-bold text-orange-700">฿{formatCurrency(curr.sellingTotalTHB)}</td>
                            <td className="px-3 md:px-5 py-2.5 md:py-3 text-right font-figure text-gray-400 border-l border-gray-100">{formatCurrency(curr.netAmount)}</td>
                            <td className="px-3 md:px-5 py-2.5 md:py-3 text-right font-figure font-bold text-blue-700">฿{formatCurrency(curr.netTotalTHB)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
