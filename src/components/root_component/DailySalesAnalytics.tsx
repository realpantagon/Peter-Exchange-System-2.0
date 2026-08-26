import { Fragment, useEffect, useMemo, useState } from 'react'
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
import { getTransactions, type DailySalesRow } from '../../lib/api'
import Spinner from '../Spinner'

interface DailySalesAnalyticsProps {
    /** Daily totals per branch for the whole range (summed by the Worker). */
    daily: DailySalesRow[]
    rangeDays: number
    setRangeDays: (days: number) => void
    loading?: boolean
}

// Fixed colors for known branches — tuned bright enough to read on a dark vault surface
const FIXED_BRANCH_COLORS: { [branch: string]: string } = {
    '4': '#4C8DFF',   // ร้าน 4 = น้ำเงิน
    '11': '#F59E0B',  // ร้าน 11 = ส้มอำพัน (แยกจากสีธีมน้ำเงินของหน้า)
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

// 'YYYY-MM-DD' (shop-local, as the summary endpoint returns it) <-> Date, kept
// away from Date.parse so a summary day never shifts by a timezone.
const dayString = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const parseDay = (day: string) => {
    const [y, m, d] = day.split('-').map(Number)
    return new Date(y, m - 1, d)
}

type Granularity = 'day' | 'week' | 'month'

// Sensible default bucket size for a given lookback window — the user can
// always override this with the รายวัน/รายสัปดาห์/รายเดือน toggle below.
const defaultGranularity = (rangeDays: number): Granularity => {
    if (rangeDays <= 14) return 'day'
    if (rangeDays <= 120) return 'week'
    return 'month'
}

const GRANULARITY_LABEL: { [k in Granularity]: string } = {
    day: 'รายวัน',
    week: 'รายสัปดาห์',
    month: 'รายเดือน',
}

const GRANULARITY_OPTIONS: Granularity[] = ['day', 'week', 'month']

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

// The [start, end] instants covered by a bucket key — what the drill-down asks
// the API for when a row or a calendar day is opened.
const bucketRange = (key: string, g: Granularity): [Date, Date] => {
    if (g === 'month') {
        const [y, m] = key.split('-').map(Number) // m is 0-based, as built above
        return [new Date(y, m, 1, 0, 0, 0, 0), new Date(y, m + 1, 0, 23, 59, 59, 999)]
    }
    const start = new Date(key)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    if (g === 'week') end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return [start, end]
}

const formatTHB = (value: number) =>
    new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(value)

// Short axis labels for narrow screens (47.7K / 5.5M) so the Y axis doesn't
// eat a third of the plot area on a phone.
const formatTHBCompact = (value: number) =>
    new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)

// Tailwind's `sm` breakpoint — recharts needs the value in JS, not just CSS.
const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
    )
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 639px)')
        const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
        mq.addEventListener('change', onChange)
        return () => mq.removeEventListener('change', onChange)
    }, [])
    return isMobile
}

const formatDateTime = (s: string) =>
    new Date(s).toLocaleString('th-TH', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    })

const formatDayLong = (d: Date) =>
    d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })

// Heatmap ink: five steps of the accent blue. Text stays dark until the
// fill is solid enough to carry white.
const HEAT_SCALE = [
    { bg: 'rgba(37, 99, 235, 0.12)', fg: 'var(--vault-paper)' },
    { bg: 'rgba(37, 99, 235, 0.30)', fg: 'var(--vault-paper)' },
    { bg: 'rgba(37, 99, 235, 0.52)', fg: '#ffffff' },
    { bg: 'rgba(37, 99, 235, 0.76)', fg: '#ffffff' },
    { bg: '#1d4ed8', fg: '#ffffff' },
]

// 0 = no sales that day; 1..5 = share of the busiest day in the range
const heatLevel = (value: number, max: number) => {
    if (value <= 0 || max <= 0) return 0
    const r = value / max
    if (r > 0.8) return 5
    if (r > 0.6) return 4
    if (r > 0.4) return 3
    if (r > 0.2) return 2
    return 1
}

const heatStyle = (level: number) =>
    level === 0
        ? { backgroundColor: 'var(--vault-panel-raised)', color: 'var(--vault-muted)' }
        : { backgroundColor: HEAT_SCALE[level - 1].bg, color: HEAT_SCALE[level - 1].fg }

const WEEKDAY_LABELS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']

// How much of the breakdown is shown before the user asks for more —
// a year of daily rows is 365 lines nobody scrolls through.
const CALENDAR_MONTHS_PREVIEW = 2
const TABLE_ROWS_PREVIEW = 7

interface DayCell {
    key: string          // Date.toDateString()
    date: Date
    day: number          // day of month
    total: number        // sum over the visible branches
    count: number        // transactions that day
    byBranch: { [branch: string]: number }
}

interface DayMonth {
    key: string
    label: string
    offset: number       // blank cells before the 1st shown day (Monday-first grid)
    total: number
    cells: DayCell[]
}

// The body of an opened bucket: a spinner while its rows are being fetched,
// the ledger once they arrive.
function DetailBody({ detail, detailKey, branchColor, withCount }: {
    detail: { key: string; items: Transaction[]; loading: boolean; error: boolean } | null
    detailKey: string
    branchColor: { [k: string]: string }
    withCount?: boolean
}) {
    if (!detail || detail.key !== detailKey || detail.loading) {
        return <div className="flex items-center gap-2 text-xs py-2" style={{ color: 'var(--vault-muted)' }}><Spinner size={14} />กำลังโหลดรายการ…</div>
    }
    if (detail.error) {
        return <div className="text-xs py-2" style={{ color: 'var(--vault-ink-debit)' }}>โหลดรายการไม่สำเร็จ ลองแตะอีกครั้ง</div>
    }
    return (
        <>
            {withCount && (
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--vault-muted)' }}>
                    รายการที่ขาย {detail.items.length} รายการ
                </div>
            )}
            <TransactionList items={detail.items} branchColor={branchColor} />
        </>
    )
}

// Raw transactions for one bucket/day. Cards on a phone (the eight-column
// table needs ~700px), the full table from sm up.
function TransactionList({ items, branchColor }: { items: Transaction[]; branchColor: { [k: string]: string } }) {
    if (items.length === 0) {
        return <div className="text-xs py-2" style={{ color: 'var(--vault-muted)' }}>ไม่มีรายการ</div>
    }

    return (
        <>
            {/* Phone: one card per transaction */}
            <div className="sm:hidden space-y-1.5">
                {items.map(t => (
                    <div key={t.id} className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline-soft)' }}>
                        <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs min-w-0" style={{ color: 'var(--vault-muted)' }}>
                                <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: branchColor[t.Branch!] }} />
                                <span className="font-figure">{formatDateTime(t.created_at!)}</span>
                                <span className="truncate">· {t.Transaction_Type || '-'}</span>
                            </span>
                            <span className="font-figure text-sm font-semibold whitespace-nowrap" style={{ color: 'var(--vault-paper)' }}>
                                ฿ {formatTHB(parseFloat(t.Total_TH || '0') || 0)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1 text-[11px]" style={{ color: 'var(--vault-muted)' }}>
                            <span className="font-figure">
                                <span className="font-semibold" style={{ color: 'var(--vault-paper)' }}>{t.Cur || t.Currency || '-'}</span>
                                {' '}{t.Amount || '-'} @ {t.Rate || '-'}
                            </span>
                            <span className="truncate max-w-[45%]" title={t.Customer_Name || ''}>{t.Customer_Name || '-'}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* sm and up: the full ledger table */}
            <div className="hidden sm:block overflow-x-auto rounded-lg" style={{ border: '1px solid var(--vault-hairline-soft)' }}>
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
                        {items.map(t => (
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
        </>
    )
}

export default function DailySalesAnalytics({ daily, rangeDays, setRangeDays, loading = false }: DailySalesAnalyticsProps) {
    // Defaults to "รายสัปดาห์" (not "รายวัน") so the breakdown table below
    // doesn't open on 30 rows of dates — the user can switch to a daily or
    // monthly bucket any time via the toggle, independent of the lookback range.
    const [granularity, setGranularity] = useState<Granularity>(() => defaultGranularity(rangeDays))

    // All branches present in the range (a closed branch simply stops appearing
    // in newer days, so this has to come from the data, not a fixed list)
    const branches = useMemo(
        () => Array.from(new Set(daily.map(r => r.branch).filter(Boolean))).sort(),
        [daily]
    )

    const [branchFilter, setBranchFilter] = useState<string>('') // '' = all branches
    const [expandedKey, setExpandedKey] = useState<string | null>(null) // which bucket row is opened
    const [chartType, setChartType] = useState<'bar' | 'line'>('bar')
    // Breakdown section: the calendar heatmap reads a whole month at a glance,
    // the table is the exact-figures fallback.
    const [breakdownView, setBreakdownView] = useState<'calendar' | 'table'>('calendar')
    const [selectedDay, setSelectedDay] = useState<string | null>(null) // toDateString key
    const [showAllMonths, setShowAllMonths] = useState(false)
    const [showAllRows, setShowAllRows] = useState(false)
    // Raw rows for the one bucket/day that is currently open
    const [detail, setDetail] = useState<{ key: string; items: Transaction[]; loading: boolean; error: boolean } | null>(null)
    const isMobile = useIsMobile()
    const visibleBranches = useMemo(() => (branchFilter ? [branchFilter] : branches), [branchFilter, branches])

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

        daily.forEach(r => {
            const bk = bucketKeyAndLabel(parseDay(r.day), granularity)
            const row = rowByKey.get(bk.key)
            if (!row) return
            row[r.branch] = (row[r.branch] as number || 0) + r.total
            totals[r.branch] = (totals[r.branch] || 0) + r.total
            grand += r.total
        })

        return { chartData: rows, branchTotals: totals, grandTotal: grand }
    }, [daily, rangeDays, granularity, branches])

    // Table rows: newest bucket first, trimmed to a preview until asked for more
    const allTableRows = useMemo(() => [...chartData].reverse(), [chartData])
    const tableRows = showAllRows ? allTableRows : allTableRows.slice(0, TABLE_ROWS_PREVIEW)

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
    const todayDay = dayString(new Date())
    const todaySales = useMemo(() => {
        const totals: { [branch: string]: number } = {}
        branches.forEach(b => (totals[b] = 0))
        daily.forEach(r => {
            if (r.day !== todayDay) return
            totals[r.branch] = (totals[r.branch] || 0) + r.total
        })
        return totals
    }, [daily, branches, todayDay])

    const currentRangeLabel = RANGE_OPTIONS.find(r => r.days === rangeDays)?.label || `${rangeDays} วัน`

    // Calendar heatmap dataset — always daily (a calendar is daily by nature),
    // so it stays useful whatever the รายวัน/รายสัปดาห์/รายเดือน toggle says.
    // Days are grouped into month grids, newest month first.
    const { calendarMonths, dayCellByKey, maxDayTotal, busiestDay, activeDayAverage } = useMemo(() => {
        const byDay = new Map<string, { byBranch: { [branch: string]: number }; total: number; count: number }>()
        daily.forEach(r => {
            if (branchFilter && r.branch !== branchFilter) return
            const entry = byDay.get(r.day) || { byBranch: {}, total: 0, count: 0 }
            entry.byBranch[r.branch] = (entry.byBranch[r.branch] || 0) + r.total
            entry.total += r.total
            entry.count += r.count
            byDay.set(r.day, entry)
        })

        const months: DayMonth[] = []
        const cellByKey = new Map<string, DayCell>()
        let max = 0
        let activeSum = 0
        let activeDays = 0
        let busiest: DayCell | null = null

        const cursor = new Date()
        cursor.setHours(0, 0, 0, 0)
        cursor.setDate(cursor.getDate() - (rangeDays - 1))
        const last = new Date()
        last.setHours(0, 0, 0, 0)

        while (cursor <= last) {
            const entry = byDay.get(dayString(cursor))
            const cell: DayCell = {
                key: cursor.toDateString(),
                date: new Date(cursor),
                day: cursor.getDate(),
                total: entry?.total || 0,
                count: entry?.count || 0,
                byBranch: entry?.byBranch || {},
            }

            cellByKey.set(cell.key, cell)
            if (cell.total > max) max = cell.total
            if (cell.total > 0) { activeSum += cell.total; activeDays++ }
            if (!busiest || cell.total > busiest.total) busiest = cell

            const monthKey = `${cursor.getFullYear()}-${cursor.getMonth()}`
            let month = months[months.length - 1]
            if (!month || month.key !== monthKey) {
                month = {
                    key: monthKey,
                    label: cursor.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }),
                    offset: (cursor.getDay() + 6) % 7, // grid starts on Monday
                    total: 0,
                    cells: [],
                }
                months.push(month)
            }
            month.cells.push(cell)
            month.total += cell.total

            cursor.setDate(cursor.getDate() + 1)
        }

        return {
            calendarMonths: months.reverse(), // newest month first
            dayCellByKey: cellByKey,
            maxDayTotal: max,
            busiestDay: busiest && busiest.total > 0 ? busiest : null,
            activeDayAverage: activeDays ? activeSum / activeDays : 0,
        }
    }, [daily, rangeDays, branchFilter])

    const shownMonths = showAllMonths ? calendarMonths : calendarMonths.slice(0, CALENDAR_MONTHS_PREVIEW)
    const selectedCell = selectedDay ? dayCellByKey.get(selectedDay) : undefined

    // The raw ledger behind one bucket is fetched only when that bucket is
    // opened — the page itself never downloads a year of transactions.
    const openDetail = async (key: string, [from, to]: [Date, Date]) => {
        setDetail({ key, items: [], loading: true, error: false })
        try {
            const rows = await getTransactions(from.toISOString(), branchFilter || undefined, to.toISOString())
            setDetail({ key, items: rows, loading: false, error: false })
        } catch {
            setDetail({ key, items: [], loading: false, error: true })
        }
    }

    const selectDay = (cell: DayCell) => {
        if (selectedDay === cell.key) {
            setSelectedDay(null)
            setDetail(null)
            return
        }
        setSelectedDay(cell.key)
        void openDetail(cell.key, [
            new Date(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate(), 0, 0, 0, 0),
            new Date(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate(), 23, 59, 59, 999),
        ])
    }

    const toggleRow = (rowKey: string) => {
        if (expandedKey === rowKey) {
            setExpandedKey(null)
            setDetail(null)
            return
        }
        setExpandedKey(rowKey)
        void openDetail(rowKey, bucketRange(rowKey, granularity))
    }

    return (
        <div className="root-vault rounded-2xl p-4 sm:p-6" style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)' }}>
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
                <h3 className="font-display text-base sm:text-lg font-semibold flex items-center gap-2 min-w-0" style={{ color: 'var(--vault-paper)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" style={{ color: 'var(--vault-brass)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18M9 17V9m4 8V5m4 12v-6" />
                    </svg>
                    <span className="truncate">ยอดขายแยกตามร้าน (THB)</span>
                    <span className="text-xs font-normal whitespace-nowrap" style={{ color: 'var(--vault-muted)' }}>· {GRANULARITY_LABEL[granularity]}</span>
                </h3>

                {/* Chart type + branch filter: on a phone these share one full-width
                    row (each half) instead of wrapping onto separate lines. */}
                <div className="flex items-center gap-2">
                    {/* Chart type toggle */}
                    <div className="flex flex-1 sm:flex-none rounded-xl p-0.5" style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)' }}>
                        <button
                            onClick={() => setChartType('bar')}
                            className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                            style={chartType === 'bar' ? { backgroundColor: 'var(--vault-brass)', color: 'var(--vault-brass-ink)' } : { color: 'var(--vault-muted)' }}
                            title="กราฟแท่ง"
                        >
                            แท่ง
                        </button>
                        <button
                            onClick={() => setChartType('line')}
                            className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                            style={chartType === 'line' ? { backgroundColor: 'var(--vault-brass)', color: 'var(--vault-brass-ink)' } : { color: 'var(--vault-muted)' }}
                            title="กราฟเส้น"
                        >
                            เส้น
                        </button>
                    </div>

                    {/* Branch filter */}
                    <select
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                        className="flex-1 sm:flex-none min-w-0 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium focus:outline-none focus:ring-2"
                        style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)', color: 'var(--vault-paper)' }}
                    >
                        <option value="">ทุกร้าน</option>
                        {branches.map(b => (
                            <option key={b} value={b}>{b}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Range selector + bucket-size (granularity) toggle — two independent
                controls: how far back to look, and how to group what's shown.
                On a phone the range chips scroll sideways on a single line rather
                than wrapping into a ragged two-row block, and the granularity
                toggle stretches to full width as a proper segmented control. */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 sm:gap-3 mb-5 sm:mb-6">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="hidden sm:inline text-xs font-semibold shrink-0" style={{ color: 'var(--vault-muted)' }}>ช่วงเวลา:</span>
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5 sm:mx-0 sm:px-0 sm:flex-wrap">
                        {RANGE_OPTIONS.map(opt => (
                            <button
                                key={opt.days}
                                onClick={() => setRangeDays(opt.days)}
                                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
                                style={rangeDays === opt.days
                                    ? { backgroundColor: 'var(--vault-brass)', color: 'var(--vault-brass-ink)' }
                                    : { backgroundColor: 'var(--vault-panel-raised)', color: 'var(--vault-muted)', border: '1px solid var(--vault-hairline)' }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="hidden sm:inline text-xs font-semibold shrink-0" style={{ color: 'var(--vault-muted)' }}>มุมมอง:</span>
                    <div className="flex w-full sm:w-auto rounded-xl p-0.5" style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)' }}>
                        {GRANULARITY_OPTIONS.map(g => (
                            <button
                                key={g}
                                onClick={() => setGranularity(g)}
                                className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
                                style={granularity === g ? { backgroundColor: 'var(--vault-brass)', color: 'var(--vault-brass-ink)' } : { color: 'var(--vault-muted)' }}
                            >
                                {GRANULARITY_LABEL[g]}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Today summary cards — the grand-total card spans the full row on a
                phone so it never sits alone beside an empty half-column. */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-5 sm:mb-6">
                {visibleBranches.map(b => (
                    <div key={b} className="rounded-xl p-3 sm:p-4" style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)' }}>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0" style={{ backgroundColor: branchColor[b] }} />
                            <span className="text-xs font-semibold truncate" style={{ color: 'var(--vault-muted)' }} title={b}>ร้าน {b}</span>
                        </div>
                        <div className="font-figure text-lg sm:text-xl font-semibold truncate" style={{ color: 'var(--vault-paper)' }}>฿ {formatTHB(todaySales[b] || 0)}</div>
                        <div className="text-[11px]" style={{ color: 'var(--vault-muted)' }}>ยอดขายวันนี้</div>
                    </div>
                ))}
                <div className="col-span-2 md:col-span-1 rounded-xl p-3 sm:p-4 relative overflow-hidden" style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-brass-border)' }}>
                    <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: 'var(--vault-brass)' }} />
                    <div className="text-xs font-semibold mb-1 truncate" style={{ color: 'var(--vault-brass)' }}>รวมทุกร้าน ({currentRangeLabel})</div>
                    <div className="font-figure text-lg sm:text-xl font-semibold truncate" style={{ color: 'var(--vault-paper)' }}>฿ {formatTHB(grandTotal)}</div>
                    <div className="text-[11px]" style={{ color: 'var(--vault-muted)' }}>total revenue</div>
                </div>
            </div>

            {/* Chart: bar (grouped) or line (connecting dots per branch + brass total) */}
            <div className="h-[260px] sm:h-[320px] w-full relative">
                {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.65)' }}>
                        <span className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--vault-muted)' }}><Spinner size={20} />กำลังโหลดข้อมูล…</span>
                    </div>
                )}
                <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                        <BarChart data={chartData} margin={{ top: 5, right: isMobile ? 4 : 20, left: isMobile ? -8 : 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vault-hairline)" />
                            <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'var(--vault-muted)', fontSize: isMobile ? 10 : 11 }}
                                dy={isMobile ? 6 : 10}
                                height={isMobile ? 24 : 30}
                                interval="preserveStartEnd"
                                minTickGap={isMobile ? 24 : 16}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'var(--vault-muted)', fontSize: isMobile ? 10 : 12 }}
                                tickFormatter={(v) => (isMobile ? formatTHBCompact(v as number) : formatTHB(v as number))}
                                width={isMobile ? 44 : 70}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                                formatter={(value, name) => [`฿ ${formatTHB(Number(value) || 0)}`, `ร้าน ${name}`]}
                                contentStyle={{ borderRadius: '12px', border: '1px solid var(--vault-hairline)', backgroundColor: 'var(--vault-panel)', color: 'var(--vault-paper)', fontSize: isMobile ? 12 : 13 }}
                                labelStyle={{ color: 'var(--vault-muted)' }}
                            />
                            <Legend formatter={(value) => `ร้าน ${value}`} wrapperStyle={{ color: 'var(--vault-muted)', fontSize: isMobile ? 11 : 12 }} iconSize={isMobile ? 9 : 14} />
                            {visibleBranches.map(b => (
                                <Bar key={b} dataKey={b} name={b} fill={branchColor[b]} radius={[6, 6, 0, 0]} maxBarSize={isMobile ? 22 : 40} />
                            ))}
                        </BarChart>
                    ) : (
                        <LineChart data={lineData} margin={{ top: 5, right: isMobile ? 8 : 20, left: isMobile ? -8 : 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vault-hairline)" />
                            <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'var(--vault-muted)', fontSize: isMobile ? 10 : 11 }}
                                dy={isMobile ? 6 : 10}
                                height={isMobile ? 24 : 30}
                                interval="preserveStartEnd"
                                minTickGap={isMobile ? 24 : 16}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'var(--vault-muted)', fontSize: isMobile ? 10 : 12 }}
                                tickFormatter={(v) => (isMobile ? formatTHBCompact(v as number) : formatTHB(v as number))}
                                width={isMobile ? 44 : 70}
                            />
                            <Tooltip
                                formatter={(value, name) => [`฿ ${formatTHB(Number(value) || 0)}`, name === 'รวม' ? 'รวมทุกร้าน' : `ร้าน ${name}`]}
                                contentStyle={{ borderRadius: '12px', border: '1px solid var(--vault-hairline)', backgroundColor: 'var(--vault-panel)', color: 'var(--vault-paper)', fontSize: isMobile ? 12 : 13 }}
                                labelStyle={{ color: 'var(--vault-muted)' }}
                            />
                            <Legend formatter={(value) => (value === 'รวม' ? 'รวมทุกร้าน' : `ร้าน ${value}`)} wrapperStyle={{ color: 'var(--vault-muted)', fontSize: isMobile ? 11 : 12 }} iconSize={isMobile ? 9 : 14} />
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
                                stroke="#1E293B"
                                strokeWidth={2.5}
                                dot={{ r: 3, fill: '#1E293B' }}
                                activeDot={{ r: 5 }}
                            />
                        </LineChart>
                    )}
                </ResponsiveContainer>
            </div>

            {/* Breakdown — a calendar heatmap by default (a whole month at a
                glance, tap a day for its ledger) with the exact-figures table
                one tap away, collapsed to the most recent buckets. */}
            <div className="mt-5 sm:mt-6 pt-4" style={{ borderTop: '1px solid var(--vault-hairline)' }}>
                <div className="flex items-center justify-between gap-2 mb-3">
                    <h4 className="text-sm font-semibold" style={{ color: 'var(--vault-paper)' }}>รายละเอียด</h4>
                    <div className="flex rounded-xl p-0.5" style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)' }}>
                        {(['calendar', 'table'] as const).map(v => (
                            <button
                                key={v}
                                onClick={() => setBreakdownView(v)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
                                style={breakdownView === v ? { backgroundColor: 'var(--vault-brass)', color: 'var(--vault-brass-ink)' } : { color: 'var(--vault-muted)' }}
                            >
                                {v === 'calendar' ? 'ปฏิทิน' : 'ตาราง'}
                            </button>
                        ))}
                    </div>
                </div>

                {breakdownView === 'calendar' ? (
                    <>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-[11px] sm:text-xs" style={{ color: 'var(--vault-muted)' }}>
                            <span>
                                เฉลี่ย <span className="font-figure font-semibold" style={{ color: 'var(--vault-paper)' }}>฿ {formatTHB(activeDayAverage)}</span> / วันที่มียอด
                            </span>
                            {busiestDay && (
                                <span>
                                    สูงสุด <span className="font-figure font-semibold" style={{ color: 'var(--vault-paper)' }}>฿ {formatTHB(busiestDay.total)}</span>
                                    {' '}({busiestDay.date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                            {shownMonths.map(m => (
                                <div key={m.key} className="rounded-xl p-3" style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)' }}>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="text-xs font-semibold truncate" style={{ color: 'var(--vault-paper)' }}>{m.label}</span>
                                        <span className="font-figure text-xs whitespace-nowrap" style={{ color: 'var(--vault-muted)' }}>฿ {formatTHB(m.total)}</span>
                                    </div>

                                    <div className="grid grid-cols-7 gap-1 mb-1">
                                        {WEEKDAY_LABELS.map(w => (
                                            <div key={w} className="text-center text-[10px]" style={{ color: 'var(--vault-muted)' }}>{w}</div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-7 gap-1">
                                        {Array.from({ length: m.offset }).map((_, i) => <div key={`pad-${i}`} className="aspect-square" />)}
                                        {m.cells.map(c => {
                                            const isSelected = selectedDay === c.key
                                            return (
                                                <button
                                                    key={c.key}
                                                    onClick={() => selectDay(c)}
                                                    title={`${c.date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} · ฿ ${formatTHB(c.total)}`}
                                                    className="aspect-square rounded-md flex items-center justify-center text-[10px] sm:text-[11px] font-figure transition-all"
                                                    style={{
                                                        ...heatStyle(heatLevel(c.total, maxDayTotal)),
                                                        outline: isSelected
                                                            ? '2px solid var(--vault-brass)'
                                                            : c.key === todayKey ? '2px solid var(--vault-brass-border)' : undefined,
                                                        outlineOffset: isSelected ? '1px' : undefined,
                                                    }}
                                                >
                                                    {c.day}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {calendarMonths.length > shownMonths.length && (
                            <button
                                onClick={() => setShowAllMonths(true)}
                                className="mt-3 w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-medium transition-all"
                                style={{ backgroundColor: 'var(--vault-panel-raised)', color: 'var(--vault-brass)', border: '1px solid var(--vault-hairline)' }}
                            >
                                ดูเดือนก่อนหน้า (อีก {calendarMonths.length - shownMonths.length} เดือน)
                            </button>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5 mt-3 text-[10px]" style={{ color: 'var(--vault-muted)' }}>
                            <span>น้อย</span>
                            {[0, 1, 2, 3, 4, 5].map(l => (
                                <span key={l} className="inline-block w-3.5 h-3.5 rounded" style={{ ...heatStyle(l), border: l === 0 ? '1px solid var(--vault-hairline)' : undefined }} />
                            ))}
                            <span>มาก</span>
                            <span className="ml-auto">แตะวันเพื่อดูรายการ</span>
                        </div>

                        {selectedCell && (
                            <div className="mt-4 rounded-xl p-3 sm:p-4" style={{ backgroundColor: 'var(--vault-bg)', border: '1px solid var(--vault-brass-border)' }}>
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <div className="min-w-0">
                                        <div className="text-xs font-semibold truncate" style={{ color: 'var(--vault-muted)' }}>
                                            {formatDayLong(selectedCell.date)}
                                            {selectedCell.key === todayKey && (
                                                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--vault-brass)', color: 'var(--vault-brass-ink)' }}>วันนี้</span>
                                            )}
                                        </div>
                                        <div className="font-figure text-lg font-semibold" style={{ color: 'var(--vault-paper)' }}>฿ {formatTHB(selectedCell.total)}</div>
                                    </div>
                                    <button onClick={() => setSelectedDay(null)} aria-label="ปิด" className="p-1.5 rounded-lg shrink-0" style={{ color: 'var(--vault-muted)' }}>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="space-y-2 mb-4">
                                    {visibleBranches.filter(b => (selectedCell.byBranch[b] || 0) > 0).map(b => {
                                        const value = selectedCell.byBranch[b] || 0
                                        const pct = selectedCell.total > 0 ? (value / selectedCell.total) * 100 : 0
                                        return (
                                            <div key={b}>
                                                <div className="flex items-center justify-between gap-2 text-xs mb-1">
                                                    <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--vault-muted)' }}>
                                                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: branchColor[b] }} />
                                                        ร้าน {b}
                                                    </span>
                                                    <span className="font-figure font-semibold whitespace-nowrap" style={{ color: 'var(--vault-paper)' }}>฿ {formatTHB(value)}</span>
                                                </div>
                                                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--vault-hairline-soft)' }}>
                                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: branchColor[b] }} />
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {selectedCell.total === 0 && (
                                        <div className="text-xs" style={{ color: 'var(--vault-muted)' }}>ไม่มียอดขายในวันนี้</div>
                                    )}
                                </div>

                                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--vault-muted)' }}>
                                    รายการที่ขาย {selectedCell.count} รายการ
                                </div>
                                <DetailBody detail={detail} detailKey={selectedCell.key} branchColor={branchColor} />
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto max-h-[420px] overflow-y-auto custom-scrollbar">
                            <table className="min-w-full text-xs sm:text-sm">
                                <thead className="sticky top-0" style={{ backgroundColor: 'var(--vault-panel)' }}>
                                    <tr className="text-left" style={{ borderBottom: '1px solid var(--vault-hairline)', color: 'var(--vault-muted)' }}>
                                        <th className="py-2 pr-3 sm:pr-4 font-semibold whitespace-nowrap">
                                            {granularity === 'day' ? 'วันที่' : granularity === 'week' ? 'สัปดาห์เริ่ม' : 'เดือน'}
                                        </th>
                                        {visibleBranches.map(b => (
                                            <th key={b} className="py-2 px-3 sm:px-4 font-semibold text-right whitespace-nowrap">ร้าน {b}</th>
                                        ))}
                                        <th className="py-2 pl-3 sm:pl-4 font-semibold text-right whitespace-nowrap">รวม</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableRows.map(row => {
                                        const rowKey = row.key as string
                                        const rowTotal = visibleBranches.reduce((s, b) => s + (row[b] as number || 0), 0)
                                        const isOpen = expandedKey === rowKey
                                        return (
                                            <Fragment key={rowKey}>
                                                <tr
                                                    className="cursor-pointer transition-colors"
                                                    style={{ borderBottom: '1px solid var(--vault-hairline-soft)', backgroundColor: isOpen ? 'var(--vault-brass-tint)' : 'transparent' }}
                                                    onClick={() => toggleRow(rowKey)}
                                                >
                                                    <td className="py-2 pr-3 sm:pr-4 whitespace-nowrap" style={{ color: 'var(--vault-paper)' }}>
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <svg className="w-3.5 h-3.5 transition-transform" style={{ color: 'var(--vault-muted)', transform: isOpen ? 'rotate(90deg)' : undefined }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                            </svg>
                                                            {row.label}
                                                        </span>
                                                        {rowKey === todayKey && (
                                                            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--vault-brass)', color: 'var(--vault-brass-ink)' }}>วันนี้</span>
                                                        )}
                                                    </td>
                                                    {visibleBranches.map(b => (
                                                        <td key={b} className="py-2 px-3 sm:px-4 text-right font-figure whitespace-nowrap" style={{ color: 'var(--vault-paper)' }}>
                                                            ฿ {formatTHB(row[b] as number || 0)}
                                                        </td>
                                                    ))}
                                                    <td className="py-2 pl-3 sm:pl-4 text-right font-figure font-semibold whitespace-nowrap" style={{ color: 'var(--vault-paper)' }}>฿ {formatTHB(rowTotal)}</td>
                                                </tr>
                                                {isOpen && (
                                                    <tr>
                                                        <td colSpan={visibleBranches.length + 2} className="p-0">
                                                            <div className="px-3 sm:px-4 py-3" style={{ backgroundColor: 'var(--vault-bg)', borderBottom: '1px solid var(--vault-hairline-soft)' }}>
                                                                <DetailBody detail={detail} detailKey={rowKey} branchColor={branchColor} withCount />
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
                                        <td className="py-2 pr-3 sm:pr-4 whitespace-nowrap">รวมทั้งหมด</td>
                                        {visibleBranches.map(b => (
                                            <td key={b} className="py-2 px-3 sm:px-4 text-right font-figure whitespace-nowrap">฿ {formatTHB(branchTotals[b] || 0)}</td>
                                        ))}
                                        <td className="py-2 pl-3 sm:pl-4 text-right font-figure whitespace-nowrap" style={{ color: 'var(--vault-brass)' }}>฿ {formatTHB(grandTotal)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {allTableRows.length > TABLE_ROWS_PREVIEW && (
                            <button
                                onClick={() => setShowAllRows(v => !v)}
                                className="mt-3 w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-medium transition-all"
                                style={{ backgroundColor: 'var(--vault-panel-raised)', color: 'var(--vault-brass)', border: '1px solid var(--vault-hairline)' }}
                            >
                                {showAllRows
                                    ? 'ย่อรายการ'
                                    : `ดูทั้งหมด ${allTableRows.length} ${granularity === 'day' ? 'วัน' : granularity === 'week' ? 'สัปดาห์' : 'เดือน'}`}
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
