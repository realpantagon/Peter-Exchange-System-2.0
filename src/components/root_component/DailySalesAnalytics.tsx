import { Fragment, useMemo, useState } from 'react'
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts'
import type { Transaction } from '../../utils/currencyUtils'

interface DailySalesAnalyticsProps {
    transactions: Transaction[]
    rangeDays: number
    setRangeDays: (days: number) => void
}

// Fixed colors for known branches
const FIXED_BRANCH_COLORS: { [branch: string]: string } = {
    '4': '#2563EB',  // ร้าน 4 = น้ำเงิน
    '11': '#EAB308', // ร้าน 11 = เหลือง
}

// Fallback palette for any other branches
const BRANCH_COLORS = ['#16A34A', '#EA580C', '#9333EA', '#DB2777', '#0891B2']

// Range options (days)
const RANGE_OPTIONS = [
    { label: '7 วัน', days: 7 },
    { label: '14 วัน', days: 14 },
    { label: '1 เดือน', days: 30 },
    { label: '3 เดือน', days: 90 },
    { label: '6 เดือน', days: 180 },
    { label: '1 ปี', days: 365 },
]

type Granularity = 'day' | 'week' | 'month'

const getGranularity = (rangeDays: number): Granularity => {
    if (rangeDays <= 31) return 'day'
    if (rangeDays <= 120) return 'week'
    return 'month'
}

const GRANULARITY_LABEL: { [k in Granularity]: string } = {
    day: 'รายวัน',
    week: 'รายสัปดาห์',
    month: 'รายเดือน',
}

// Map a date to its bucket key + display label for the chosen granularity
const bucketKeyAndLabel = (d: Date, g: Granularity): { key: string; label: string } => {
    if (g === 'day') {
        return { key: d.toDateString(), label: d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' }) }
    }
    if (g === 'week') {
        // Week starting Monday
        const monday = new Date(d)
        const offset = (monday.getDay() + 6) % 7 // 0 = Monday
        monday.setDate(monday.getDate() - offset)
        monday.setHours(0, 0, 0, 0)
        return { key: monday.toDateString(), label: monday.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' }) }
    }
    // month
    return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' })
    }
}

const formatTHB = (value: number) =>
    new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(value)

export default function DailySalesAnalytics({ transactions, rangeDays, setRangeDays }: DailySalesAnalyticsProps) {
    const granularity = getGranularity(rangeDays)

    // All branches present in data
    const branches = useMemo(
        () => Array.from(new Set(transactions.map(t => t.Branch).filter(Boolean))) as string[],
        [transactions]
    )

    const [branchFilter, setBranchFilter] = useState<string>('') // '' = all branches
    const [expandedKey, setExpandedKey] = useState<string | null>(null) // which bucket row is opened
    const [chartType, setChartType] = useState<'bar' | 'line'>('bar')
    const visibleBranches = branchFilter ? [branchFilter] : branches

    const branchColor = useMemo(() => {
        const map: { [key: string]: string } = {}
        let fallbackIdx = 0
        branches.forEach((b) => {
            if (FIXED_BRANCH_COLORS[b]) {
                map[b] = FIXED_BRANCH_COLORS[b]
            } else {
                map[b] = BRANCH_COLORS[fallbackIdx % BRANCH_COLORS.length]
                fallbackIdx++
            }
        })
        return map
    }, [branches])

    // Build chart data: one row per bucket (day/week/month), one key per branch = sum(Total_TH)
    const { chartData, branchTotals, grandTotal } = useMemo(() => {
        // Pre-generate empty buckets across the whole range so gaps show as 0
        const ordered: { key: string; label: string }[] = []
        const seen = new Set<string>()
        const today = new Date()
        for (let i = rangeDays - 1; i >= 0; i--) {
            const d = new Date(today)
            d.setDate(d.getDate() - i)
            const bk = bucketKeyAndLabel(d, granularity)
            if (!seen.has(bk.key)) {
                seen.add(bk.key)
                ordered.push(bk)
            }
        }

        const rows = ordered.map(bk => {
            const row: { key: string; label: string; [branch: string]: number | string } = {
                key: bk.key,
                label: bk.label
            }
            branches.forEach(b => (row[b] = 0))
            return row
        })

        const rowByKey = new Map(rows.map(r => [r.key as string, r]))
        const totals: { [branch: string]: number } = {}
        branches.forEach(b => (totals[b] = 0))
        let grand = 0

        transactions.forEach(t => {
            if (!t.created_at || !t.Branch) return
            const bk = bucketKeyAndLabel(new Date(t.created_at), granularity)
            const row = rowByKey.get(bk.key)
            if (!row) return
            const amount = parseFloat(t.Total_TH || '0') || 0
            row[t.Branch] = (row[t.Branch] as number) + amount
            totals[t.Branch] += amount
            grand += amount
        })

        return { chartData: rows, branchTotals: totals, grandTotal: grand }
    }, [transactions, rangeDays, granularity, branches])

    // Line-chart dataset: includes a __total per bucket (sum of visible branches)
    const lineData = useMemo(
        () => chartData.map(row => ({
            ...row,
            __total: visibleBranches.reduce((s, b) => s + (row[b] as number || 0), 0)
        })),
        [chartData, visibleBranches]
    )

    // Today's sales per branch (always the actual current day)
    const todayKey = new Date().toDateString()
    const todaySales = useMemo(() => {
        const totals: { [branch: string]: number } = {}
        branches.forEach(b => (totals[b] = 0))
        transactions.forEach(t => {
            if (!t.created_at || !t.Branch) return
            if (new Date(t.created_at).toDateString() !== todayKey) return
            totals[t.Branch] += parseFloat(t.Total_TH || '0') || 0
        })
        return totals
    }, [transactions, branches, todayKey])

    const currentRangeLabel = RANGE_OPTIONS.find(r => r.days === rangeDays)?.label || `${rangeDays} วัน`

    // Transactions belonging to a given bucket (respects branch filter), newest first
    const getBucketTransactions = (key: string) =>
        transactions
            .filter(t => {
                if (!t.created_at || !t.Branch) return false
                if (branchFilter && t.Branch !== branchFilter) return false
                return bucketKeyAndLabel(new Date(t.created_at), granularity).key === key
            })
            .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())

    const formatDateTime = (s: string) =>
        new Date(s).toLocaleString('th-TH', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
        })

    return (
        <div className="bg-white/50 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-100/50 p-6 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18M9 17V9m4 8V5m4 12v-6" />
                    </svg>
                    ยอดขายแยกตามร้าน (THB)
                    <span className="text-xs font-medium text-gray-400">· {GRANULARITY_LABEL[granularity]}</span>
                </h3>

                <div className="flex items-center gap-2">
                    {/* Chart type toggle */}
                    <div className="flex rounded-xl border border-gray-200 bg-white p-0.5">
                        <button
                            onClick={() => setChartType('bar')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${chartType === 'bar' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                            title="กราฟแท่ง"
                        >
                            แท่ง
                        </button>
                        <button
                            onClick={() => setChartType('line')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${chartType === 'line' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                            title="กราฟเส้น"
                        >
                            เส้น
                        </button>
                    </div>

                    {/* Branch filter */}
                    <select
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                        <option value="">ทุกร้าน</option>
                        {branches.map(b => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Range selector */}
            <div className="flex flex-wrap gap-2 mb-6">
                {RANGE_OPTIONS.map(opt => (
                    <button
                        key={opt.days}
                        onClick={() => setRangeDays(opt.days)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${rangeDays === opt.days
                            ? 'bg-green-600 text-white shadow-md shadow-green-200'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Today summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {visibleBranches.map(b => (
                    <div key={b} className="rounded-xl border border-gray-100 bg-white/70 p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: branchColor[b] }} />
                            <span className="text-xs font-semibold text-gray-500 truncate" title={b}>ร้าน {b}</span>
                        </div>
                        <div className="text-xl font-bold text-gray-800">฿{formatTHB(todaySales[b] || 0)}</div>
                        <div className="text-[11px] text-gray-400">ยอดขายวันนี้</div>
                    </div>
                ))}
                <div className="rounded-xl border border-green-100 bg-green-50/70 p-4">
                    <div className="text-xs font-semibold text-green-600 mb-1">รวมทุกร้าน ({currentRangeLabel})</div>
                    <div className="text-xl font-bold text-green-700">฿{formatTHB(grandTotal)}</div>
                    <div className="text-[11px] text-green-500/70">total revenue</div>
                </div>
            </div>

            {/* Chart: bar (grouped) or line (connecting dots per branch + black total) */}
            <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#6B7280', fontSize: 11 }}
                                dy={10}
                                interval="preserveStartEnd"
                                minTickGap={16}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#6B7280', fontSize: 12 }}
                                tickFormatter={(v) => formatTHB(v as number)}
                                width={70}
                            />
                            <Tooltip
                                cursor={{ fill: '#F3F4F6' }}
                                formatter={(value, name) => [`฿${formatTHB(Number(value) || 0)}`, `ร้าน ${name}`]}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                            />
                            <Legend formatter={(value) => `ร้าน ${value}`} />
                            {visibleBranches.map(b => (
                                <Bar key={b} dataKey={b} name={b} fill={branchColor[b]} radius={[6, 6, 0, 0]} maxBarSize={40} />
                            ))}
                        </BarChart>
                    ) : (
                        <LineChart data={lineData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#6B7280', fontSize: 11 }}
                                dy={10}
                                interval="preserveStartEnd"
                                minTickGap={16}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#6B7280', fontSize: 12 }}
                                tickFormatter={(v) => formatTHB(v as number)}
                                width={70}
                            />
                            <Tooltip
                                formatter={(value, name) => [`฿${formatTHB(Number(value) || 0)}`, name === 'รวม' ? 'รวมทุกร้าน' : `ร้าน ${name}`]}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                            />
                            <Legend formatter={(value) => (value === 'รวม' ? 'รวมทุกร้าน' : `ร้าน ${value}`)} />
                            {visibleBranches.map(b => (
                                <Line
                                    key={b}
                                    type="monotone"
                                    dataKey={b}
                                    name={b}
                                    stroke={branchColor[b]}
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: branchColor[b] }}
                                    activeDot={{ r: 5 }}
                                    connectNulls
                                />
                            ))}
                            <Line
                                type="monotone"
                                dataKey="__total"
                                name="รวม"
                                stroke="#000000"
                                strokeWidth={2.5}
                                dot={{ r: 3, fill: '#000000' }}
                                activeDot={{ r: 5 }}
                            />
                        </LineChart>
                    )}
                </ResponsiveContainer>
            </div>

            {/* Breakdown table */}
            <div className="mt-6 overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                        <tr className="text-left text-gray-500 border-b border-gray-200">
                            <th className="py-2 pr-4 font-semibold">
                                {granularity === 'day' ? 'วันที่' : granularity === 'week' ? 'สัปดาห์เริ่ม' : 'เดือน'}
                            </th>
                            {visibleBranches.map(b => (
                                <th key={b} className="py-2 px-4 font-semibold text-right">ร้าน {b}</th>
                            ))}
                            <th className="py-2 pl-4 font-semibold text-right">รวม</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...chartData].reverse().map(row => {
                            const rowKey = row.key as string
                            const rowTotal = visibleBranches.reduce((s, b) => s + (row[b] as number || 0), 0)
                            const isOpen = expandedKey === rowKey
                            const detailTx = isOpen ? getBucketTransactions(rowKey) : []
                            return (
                                <Fragment key={rowKey}>
                                    <tr
                                        className={`border-b border-gray-100 cursor-pointer transition-colors ${isOpen ? 'bg-green-50/60' : 'hover:bg-gray-50'}`}
                                        onClick={() => setExpandedKey(isOpen ? null : rowKey)}
                                    >
                                        <td className="py-2 pr-4 text-gray-700">
                                            <span className="inline-flex items-center gap-1.5">
                                                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                                {row.label}
                                            </span>
                                            {rowKey === todayKey && (
                                                <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">วันนี้</span>
                                            )}
                                        </td>
                                        {visibleBranches.map(b => (
                                            <td key={b} className="py-2 px-4 text-right text-gray-700">
                                                ฿{formatTHB(row[b] as number || 0)}
                                            </td>
                                        ))}
                                        <td className="py-2 pl-4 text-right font-semibold text-gray-900">฿{formatTHB(rowTotal)}</td>
                                    </tr>
                                    {isOpen && (
                                        <tr>
                                            <td colSpan={visibleBranches.length + 2} className="p-0">
                                                <div className="bg-gray-50/80 px-4 py-3 border-b border-gray-100">
                                                    <div className="text-xs font-semibold text-gray-500 mb-2">
                                                        รายการที่ขาย {detailTx.length} รายการ
                                                    </div>
                                                    {detailTx.length === 0 ? (
                                                        <div className="text-xs text-gray-400 py-2">ไม่มีรายการ</div>
                                                    ) : (
                                                        <div className="overflow-x-auto rounded-lg border border-gray-100 bg-white">
                                                            <table className="min-w-full text-xs">
                                                                <thead>
                                                                    <tr className="text-left text-gray-400 border-b border-gray-100 bg-gray-50/50">
                                                                        <th className="py-1.5 px-3 font-medium">เวลา</th>
                                                                        <th className="py-1.5 px-3 font-medium">ร้าน</th>
                                                                        <th className="py-1.5 px-3 font-medium">ประเภท</th>
                                                                        <th className="py-1.5 px-3 font-medium">สกุล</th>
                                                                        <th className="py-1.5 px-3 font-medium text-right">จำนวน</th>
                                                                        <th className="py-1.5 px-3 font-medium text-right">เรต</th>
                                                                        <th className="py-1.5 px-3 font-medium text-right">รวม (฿)</th>
                                                                        <th className="py-1.5 px-3 font-medium">ลูกค้า</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {detailTx.map(t => (
                                                                        <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                                                                            <td className="py-1.5 px-3 text-gray-600 whitespace-nowrap">{formatDateTime(t.created_at!)}</td>
                                                                            <td className="py-1.5 px-3">
                                                                                <span className="inline-flex items-center gap-1">
                                                                                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: branchColor[t.Branch!] }} />
                                                                                    {t.Branch}
                                                                                </span>
                                                                            </td>
                                                                            <td className="py-1.5 px-3 text-gray-600">{t.Transaction_Type || '-'}</td>
                                                                            <td className="py-1.5 px-3 font-medium text-gray-700">{t.Cur || t.Currency || '-'}</td>
                                                                            <td className="py-1.5 px-3 text-right text-gray-600">{t.Amount || '-'}</td>
                                                                            <td className="py-1.5 px-3 text-right text-gray-600">{t.Rate || '-'}</td>
                                                                            <td className="py-1.5 px-3 text-right font-semibold text-gray-800">฿{formatTHB(parseFloat(t.Total_TH || '0') || 0)}</td>
                                                                            <td className="py-1.5 px-3 text-gray-600 max-w-[140px] truncate" title={t.Customer_Name || ''}>{t.Customer_Name || '-'}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            )
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-gray-200 font-bold text-gray-900 sticky bottom-0 bg-white">
                            <td className="py-2 pr-4">รวมทั้งหมด</td>
                            {visibleBranches.map(b => (
                                <td key={b} className="py-2 px-4 text-right">฿{formatTHB(branchTotals[b] || 0)}</td>
                            ))}
                            <td className="py-2 pl-4 text-right text-green-700">฿{formatTHB(grandTotal)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    )
}
