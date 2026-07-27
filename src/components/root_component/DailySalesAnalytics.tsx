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

// Fixed colors for known branches — tuned bright enough to read on a dark vault surface
const FIXED_BRANCH_COLORS: { [branch: string]: string } = {
    '4': '#4C8DFF',   // ร้าน 4 = น้ำเงิน
    '11': '#CBA135',  // ร้าน 11 = ทองเหลือง
}

// Fallback palette for any other branches
const BRANCH_COLORS = ['#34D399', '#FB923C', '#A78BFA', '#F472B6', '#22D3EE']

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
        <div className="root-vault rounded-2xl p-5 sm:p-6" style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)' }}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <h3 className="font-display text-base sm:text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--vault-paper)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" style={{ color: 'var(--vault-brass)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18M9 17V9m4 8V5m4 12v-6" />
                    </svg>
                    ยอดขายแยกตามร้าน (THB)
                    <span className="text-xs font-normal" style={{ color: 'var(--vault-muted)' }}>· {GRANULARITY_LABEL[granularity]}</span>
                </h3>

                <div className="flex items-center gap-2">
                    {/* Chart type toggle */}
                    <div className="flex rounded-xl p-0.5" style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)' }}>
                        <button
                            onClick={() => setChartType('bar')}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                            style={chartType === 'bar' ? { backgroundColor: 'var(--vault-brass)', color: '#1a1305' } : { color: 'var(--vault-muted)' }}
                            title="กราฟแท่ง"
                        >
                            แท่ง
                        </button>
                        <button
                            onClick={() => setChartType('line')}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                            style={chartType === 'line' ? { backgroundColor: 'var(--vault-brass)', color: '#1a1305' } : { color: 'var(--vault-muted)' }}
                            title="กราฟเส้น"
                        >
                            เส้น
                        </button>
                    </div>

                    {/* Branch filter */}
                    <select
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        className="px-4 py-2 rounded-xl text-sm font-medium focus:outline-none focus:ring-2"
                        style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)', color: 'var(--vault-paper)' }}
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
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={rangeDays === opt.days
                            ? { backgroundColor: 'var(--vault-brass)', color: '#1a1305' }
                            : { backgroundColor: 'var(--vault-panel-raised)', color: 'var(--vault-muted)', border: '1px solid var(--vault-hairline)' }}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Today summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {visibleBranches.map(b => (
                    <div key={b} className="rounded-xl p-4" style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)' }}>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: branchColor[b] }} />
                            <span className="text-xs font-semibold truncate" style={{ color: 'var(--vault-muted)' }} title={b}>ร้าน {b}</span>
                        </div>
                        <div className="font-figure text-xl font-semibold" style={{ color: 'var(--vault-paper)' }}>฿ {formatTHB(todaySales[b] || 0)}</div>
                        <div className="text-[11px]" style={{ color: 'var(--vault-muted)' }}>ยอดขายวันนี้</div>
                    </div>
                ))}
                <div className="rounded-xl p-4 relative overflow-hidden" style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid rgba(184, 134, 11,0.4)' }}>
                    <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: 'var(--vault-brass)' }} />
                    <div className="text-xs font-semibold mb-1" style={{ color: 'var(--vault-brass)' }}>รวมทุกร้าน ({currentRangeLabel})</div>
                    <div className="font-figure text-xl font-semibold" style={{ color: 'var(--vault-paper)' }}>฿ {formatTHB(grandTotal)}</div>
                    <div className="text-[11px]" style={{ color: 'var(--vault-muted)' }}>total revenue</div>
                </div>
            </div>

            {/* Chart: bar (grouped) or line (connecting dots per branch + brass total) */}
            <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vault-hairline)" />
                            <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'var(--vault-muted)', fontSize: 11 }}
                                dy={10}
                                interval="preserveStartEnd"
                                minTickGap={16}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'var(--vault-muted)', fontSize: 12 }}
                                tickFormatter={(v) => formatTHB(v as number)}
                                width={70}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                                formatter={(value, name) => [`฿ ${formatTHB(Number(value) || 0)}`, `ร้าน ${name}`]}
                                contentStyle={{ borderRadius: '12px', border: '1px solid #E1DACB', backgroundColor: '#FFFFFF', color: '#221E14' }}
                                labelStyle={{ color: '#8A8370' }}
                            />
                            <Legend formatter={(value) => `ร้าน ${value}`} wrapperStyle={{ color: 'var(--vault-muted)', fontSize: 12 }} />
                            {visibleBranches.map(b => (
                                <Bar key={b} dataKey={b} name={b} fill={branchColor[b]} radius={[6, 6, 0, 0]} maxBarSize={40} />
                            ))}
                        </BarChart>
                    ) : (
                        <LineChart data={lineData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vault-hairline)" />
                            <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'var(--vault-muted)', fontSize: 11 }}
                                dy={10}
                                interval="preserveStartEnd"
                                minTickGap={16}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'var(--vault-muted)', fontSize: 12 }}
                                tickFormatter={(v) => formatTHB(v as number)}
                                width={70}
                            />
                            <Tooltip
                                formatter={(value, name) => [`฿ ${formatTHB(Number(value) || 0)}`, name === 'รวม' ? 'รวมทุกร้าน' : `ร้าน ${name}`]}
                                contentStyle={{ borderRadius: '12px', border: '1px solid #E1DACB', backgroundColor: '#FFFFFF', color: '#221E14' }}
                                labelStyle={{ color: '#8A8370' }}
                            />
                            <Legend formatter={(value) => (value === 'รวม' ? 'รวมทุกร้าน' : `ร้าน ${value}`)} wrapperStyle={{ color: 'var(--vault-muted)', fontSize: 12 }} />
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
                                stroke="#CBA135"
                                strokeWidth={2.5}
                                dot={{ r: 3, fill: '#CBA135' }}
                                activeDot={{ r: 5 }}
                            />
                        </LineChart>
                    )}
                </ResponsiveContainer>
            </div>

            {/* Breakdown table */}
            <div className="mt-6 overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
                <table className="min-w-full text-sm">
                    <thead className="sticky top-0" style={{ backgroundColor: 'var(--vault-panel)' }}>
                        <tr className="text-left" style={{ borderBottom: '1px solid var(--vault-hairline)', color: 'var(--vault-muted)' }}>
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
                                        className="cursor-pointer transition-colors"
                                        style={{ borderBottom: '1px solid var(--vault-hairline-soft)', backgroundColor: isOpen ? 'rgba(184, 134, 11,0.08)' : 'transparent' }}
                                        onClick={() => setExpandedKey(isOpen ? null : rowKey)}
                                    >
                                        <td className="py-2 pr-4" style={{ color: 'var(--vault-paper)' }}>
                                            <span className="inline-flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5 transition-transform" style={{ color: 'var(--vault-muted)', transform: isOpen ? 'rotate(90deg)' : undefined }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                                {row.label}
                                            </span>
                                            {rowKey === todayKey && (
                                                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--vault-brass)', color: '#1a1305' }}>วันนี้</span>
                                            )}
                                        </td>
                                        {visibleBranches.map(b => (
                                            <td key={b} className="py-2 px-4 text-right font-figure" style={{ color: 'var(--vault-paper)' }}>
                                                ฿ {formatTHB(row[b] as number || 0)}
                                            </td>
                                        ))}
                                        <td className="py-2 pl-4 text-right font-figure font-semibold" style={{ color: 'var(--vault-paper)' }}>฿ {formatTHB(rowTotal)}</td>
                                    </tr>
                                    {isOpen && (
                                        <tr>
                                            <td colSpan={visibleBranches.length + 2} className="p-0">
                                                <div className="px-4 py-3" style={{ backgroundColor: 'var(--vault-bg)', borderBottom: '1px solid var(--vault-hairline-soft)' }}>
                                                    <div className="text-xs font-semibold mb-2" style={{ color: 'var(--vault-muted)' }}>
                                                        รายการที่ขาย {detailTx.length} รายการ
                                                    </div>
                                                    {detailTx.length === 0 ? (
                                                        <div className="text-xs py-2" style={{ color: 'var(--vault-muted)' }}>ไม่มีรายการ</div>
                                                    ) : (
                                                        <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--vault-hairline-soft)' }}>
                                                            <table className="min-w-full text-xs">
                                                                <thead>
                                                                    <tr className="text-left" style={{ borderBottom: '1px solid var(--vault-hairline-soft)', color: 'var(--vault-muted)' }}>
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
                                                                        <tr key={t.id} style={{ borderBottom: '1px solid var(--vault-hairline-soft)' }}>
                                                                            <td className="py-1.5 px-3 whitespace-nowrap font-figure" style={{ color: 'var(--vault-muted)' }}>{formatDateTime(t.created_at!)}</td>
                                                                            <td className="py-1.5 px-3">
                                                                                <span className="inline-flex items-center gap-1" style={{ color: 'var(--vault-paper)' }}>
                                                                                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: branchColor[t.Branch!] }} />
                                                                                    {t.Branch}
                                                                                </span>
                                                                            </td>
                                                                            <td className="py-1.5 px-3" style={{ color: 'var(--vault-muted)' }}>{t.Transaction_Type || '-'}</td>
                                                                            <td className="py-1.5 px-3 font-medium" style={{ color: 'var(--vault-paper)' }}>{t.Cur || t.Currency || '-'}</td>
                                                                            <td className="py-1.5 px-3 text-right font-figure" style={{ color: 'var(--vault-muted)' }}>{t.Amount || '-'}</td>
                                                                            <td className="py-1.5 px-3 text-right font-figure" style={{ color: 'var(--vault-muted)' }}>{t.Rate || '-'}</td>
                                                                            <td className="py-1.5 px-3 text-right font-figure font-semibold" style={{ color: 'var(--vault-paper)' }}>฿ {formatTHB(parseFloat(t.Total_TH || '0') || 0)}</td>
                                                                            <td className="py-1.5 px-3 max-w-[140px] truncate" style={{ color: 'var(--vault-muted)' }} title={t.Customer_Name || ''}>{t.Customer_Name || '-'}</td>
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
                        <tr className="font-bold sticky bottom-0" style={{ borderTop: '2px solid var(--vault-hairline)', backgroundColor: 'var(--vault-panel)', color: 'var(--vault-paper)' }}>
                            <td className="py-2 pr-4">รวมทั้งหมด</td>
                            {visibleBranches.map(b => (
                                <td key={b} className="py-2 px-4 text-right font-figure">฿ {formatTHB(branchTotals[b] || 0)}</td>
                            ))}
                            <td className="py-2 pl-4 text-right font-figure" style={{ color: 'var(--vault-brass)' }}>฿ {formatTHB(grandTotal)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    )
}
