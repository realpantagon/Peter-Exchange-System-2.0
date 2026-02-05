import { useState, useEffect } from 'react'
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

export default function SuperAdminPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [branchSummaries, setBranchSummaries] = useState<BranchSummary[]>([])
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
    const filteredTransactions = transactions.filter(transaction => {
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
    })

    useEffect(() => {
        fetchTransactions()
    }, [])

    useEffect(() => {
        calculateBranchSummaries()
    }, [filteredTransactions])

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

    const calculateBranchSummaries = () => {
        const branchMap = new Map<string, BranchSummary>()

        filteredTransactions.forEach(transaction => {
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

        setBranchSummaries(Array.from(branchMap.values()).sort((a, b) =>
            a.branchId.localeCompare(b.branchId)
        ))
    }

    const formatCurrency = (amount: number) => {
        return amount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })
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
                        <div>
                            <h1 className="text-xl md:text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
                            <p className="text-xs md:text-sm text-gray-600 mt-1">All Branch Summary</p>
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

                {/* Grand Total Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
                    <div className="bg-white rounded-lg shadow-md border-2 border-blue-200 p-3 md:p-4">
                        <div className="text-xs text-blue-600 font-semibold uppercase mb-1">Total Branches</div>
                        <div className="text-2xl md:text-3xl font-bold text-blue-700">{branchSummaries.length}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow-md border-2 border-green-200 p-3 md:p-4">
                        <div className="text-xs text-green-600 font-semibold uppercase mb-1">Buying Transactions</div>
                        <div className="text-2xl md:text-3xl font-bold text-green-700">{totalBuyingTransactions}</div>
                        <div className="text-xs md:text-sm text-green-600 mt-1">฿{formatCurrency(totalBuyingAmount)}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow-md border-2 border-orange-200 p-3 md:p-4">
                        <div className="text-xs text-orange-600 font-semibold uppercase mb-1">Selling Transactions</div>
                        <div className="text-2xl md:text-3xl font-bold text-orange-700">{totalSellingTransactions}</div>
                        <div className="text-xs md:text-sm text-orange-600 mt-1">฿{formatCurrency(totalSellingAmount)}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow-md border-2 border-purple-200 p-3 md:p-4">
                        <div className="text-xs text-purple-600 font-semibold uppercase mb-1">Grand Total (THB)</div>
                        <div className="text-2xl md:text-3xl font-bold text-purple-700">฿{formatCurrency(grandTotal)}</div>
                    </div>
                </div>

                {/* Overall Currency Summary Table */}
                <div className="bg-white rounded-xl shadow-lg border-2 border-purple-200 mb-4 md:mb-6">
                    <div className="p-4 md:p-6 border-b-2 border-purple-200 bg-gradient-to-r from-purple-50 to-white">
                        <h2 className="text-lg md:text-2xl font-bold text-purple-900">Overall Currency Summary (All Branches)</h2>
                        <p className="text-xs md:text-sm text-gray-600 mt-1">Aggregated data from all branches</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs md:text-sm">
                            <thead className="bg-gradient-to-r from-purple-100 to-purple-50">
                                <tr>
                                    <th className="px-2 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-purple-200">
                                        Flag
                                    </th>
                                    <th className="px-2 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-purple-200">
                                        Cur
                                    </th>
                                    <th className="px-2 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-purple-200">
                                        Buy Amt
                                    </th>
                                    <th className="px-2 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-purple-200">
                                        Buy THB
                                    </th>
                                    <th className="px-2 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-purple-200">
                                        Sell Amt
                                    </th>
                                    <th className="px-2 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-purple-200">
                                        Sell THB
                                    </th>
                                    <th className="px-2 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-purple-200">
                                        Net Amt
                                    </th>
                                    <th className="px-2 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-purple-200">
                                        Net THB
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {Array.from(overallCurrencySummary.values())
                                    .sort((a, b) => {
                                        // Custom order: USD, EUR, GBP, JPY, CNY, others alphabetically
                                        const order = [
                                            "USD",
                                            "USD2",
                                            "USD1",
                                            "EUR",
                                            "JPY",
                                            "GBP",
                                            "SGD",
                                            "AUD",
                                            "CHF",
                                            "HKD",
                                            "CAD",
                                            "NZD",
                                            "TWD",
                                            "MYR",
                                            "CNY",
                                            "KRW"
                                        ]
                                        const aIndex = order.indexOf(a.currency)
                                        const bIndex = order.indexOf(b.currency)

                                        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
                                        if (aIndex !== -1) return -1
                                        if (bIndex !== -1) return 1
                                        return a.currency.localeCompare(b.currency)
                                    })
                                    .map((curr) => (
                                        <tr key={curr.currency} className="hover:bg-purple-50 transition-all">
                                            <td className="px-2 md:px-6 py-2 md:py-3 whitespace-nowrap">
                                                <img
                                                    src={getFlagIcon(curr.currency)}
                                                    alt={`${curr.currency} flag`}
                                                    className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-gray-100 object-cover"
                                                    onError={(e) => {
                                                        e.currentTarget.src = '/vite.svg'
                                                    }}
                                                />
                                            </td>
                                            <td className="px-2 md:px-6 py-2 md:py-3 whitespace-nowrap font-bold text-gray-900">
                                                {curr.currency}
                                            </td>
                                            <td className="px-2 md:px-6 py-2 md:py-3 whitespace-nowrap font-semibold text-green-700">
                                                {formatCurrency(curr.buyingAmount)}
                                            </td>
                                            <td className="px-2 md:px-6 py-2 md:py-3 whitespace-nowrap font-bold text-green-700 bg-green-50 rounded">
                                                ฿{formatCurrency(curr.buyingTotalTHB)}
                                            </td>
                                            <td className="px-2 md:px-6 py-2 md:py-3 whitespace-nowrap font-semibold text-orange-700">
                                                {formatCurrency(curr.sellingAmount)}
                                            </td>
                                            <td className="px-2 md:px-6 py-2 md:py-3 whitespace-nowrap font-bold text-orange-700 bg-orange-50 rounded">
                                                ฿{formatCurrency(curr.sellingTotalTHB)}
                                            </td>
                                            <td className="px-2 md:px-6 py-2 md:py-3 whitespace-nowrap font-semibold text-purple-700">
                                                {formatCurrency(curr.netAmount)}
                                            </td>
                                            <td className="px-2 md:px-6 py-2 md:py-3 whitespace-nowrap font-bold text-purple-700 bg-purple-50 rounded">
                                                ฿{formatCurrency(curr.netTotalTHB)}
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Individual Branch Tables */}
                <div className="space-y-4 md:space-y-6">
                    {branchSummaries.map((branch) => (
                        <div key={branch.branchId} className="bg-white rounded-xl shadow-lg border-2 border-gray-200">
                            <div className="p-4 md:p-6 border-b-2 border-gray-200 bg-gradient-to-r from-blue-50 to-white">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <h3 className="text-lg md:text-xl font-bold text-gray-900">Branch: {branch.branchId}</h3>
                                        <div className="flex flex-wrap gap-2 md:gap-4 mt-2 text-xs md:text-sm">
                                            <span className="text-gray-600">
                                                <span className="font-semibold">Total:</span> {branch.totalTransactions}
                                            </span>
                                            <span className="text-green-600">
                                                <span className="font-semibold">Buy:</span> {branch.buyingCount} (฿{formatCurrency(branch.buyingTotal)})
                                            </span>
                                            <span className="text-orange-600">
                                                <span className="font-semibold">Sell:</span> {branch.sellingCount} (฿{formatCurrency(branch.sellingTotal)})
                                            </span>
                                            <span className="text-purple-600">
                                                <span className="font-semibold">Net:</span> ฿{formatCurrency(branch.netTotalTHB)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-xs md:text-sm">
                                    <thead className="bg-gradient-to-r from-gray-100 to-gray-50">
                                        <tr>
                                            <th className="px-2 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200">
                                                Flag
                                            </th>
                                            <th className="px-2 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200">
                                                Cur
                                            </th>
                                            <th className="px-2 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200">
                                                Buy Amt
                                            </th>
                                            <th className="px-2 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200">
                                                Buy THB
                                            </th>
                                            <th className="px-2 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200">
                                                Sell Amt
                                            </th>
                                            <th className="px-2 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200">
                                                Sell THB
                                            </th>
                                            <th className="px-2 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200">
                                                Net Amt
                                            </th>
                                            <th className="px-2 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200">
                                                Net THB
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {Array.from(branch.currencies.values())
                                            .sort((a, b) => {
                                                // Order from the image
                                                const order = ['USD', 'USD2', 'USD1', 'EUR', 'JPY', 'GBP', 'SGD', 'AUD', 'CHF', 'HKD', 'CAD', 'NZD', 'TWD', 'MYR', 'CNY', 'KRW']
                                                const aIndex = order.indexOf(a.currency)
                                                const bIndex = order.indexOf(b.currency)

                                                if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
                                                if (aIndex !== -1) return -1
                                                if (bIndex !== -1) return 1
                                                return a.currency.localeCompare(b.currency)
                                            })
                                            .map((curr) => (
                                                <tr key={curr.currency} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all">
                                                    <td className="px-2 md:px-6 py-2 md:py-3 whitespace-nowrap">
                                                        <img
                                                            src={getFlagIcon(curr.currency)}
                                                            alt={`${curr.currency} flag`}
                                                            className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-gray-100 object-cover"
                                                            onError={(e) => {
                                                                e.currentTarget.src = '/vite.svg'
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-2 md:px-6 py-2 md:py-3 whitespace-nowrap font-bold text-gray-900">
                                                        {curr.currency}
                                                    </td>
                                                    <td className="px-2 md:px-6 py-2 md:py-3 whitespace-nowrap font-semibold text-green-700">
                                                        {formatCurrency(curr.buyingAmount)}
                                                    </td>
                                                    <td className="px-2 md:px-6 py-2 md:py-3 whitespace-nowrap font-bold text-green-700 bg-green-50 rounded">
                                                        ฿{formatCurrency(curr.buyingTotalTHB)}
                                                    </td>
                                                    <td className="px-2 md:px-6 py-2 md:py-3 whitespace-nowrap font-semibold text-orange-700">
                                                        {formatCurrency(curr.sellingAmount)}
                                                    </td>
                                                    <td className="px-2 md:px-6 py-2 md:py-3 whitespace-nowrap font-bold text-orange-700 bg-orange-50 rounded">
                                                        ฿{formatCurrency(curr.sellingTotalTHB)}
                                                    </td>
                                                    <td className="px-2 md:px-6 py-2 md:py-3 whitespace-nowrap font-semibold text-purple-700">
                                                        {formatCurrency(curr.netAmount)}
                                                    </td>
                                                    <td className="px-2 md:px-6 py-2 md:py-3 whitespace-nowrap font-bold text-purple-700 bg-purple-50 rounded">
                                                        ฿{formatCurrency(curr.netTotalTHB)}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
