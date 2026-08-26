import { useEffect, useMemo, useState } from 'react'
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { getRates, getRateHistory, type RateHistoryRow } from '../lib/api'
import type { PeterExchangeRate } from '../types/database'

// Line styling — Super Rich = reference (amber/orange), our rates = blue band.
const SERIES = [
    { key: 'sr_buying', name: 'Super Rich รับซื้อ', color: '#F59E0B', dash: '4 3' },
    { key: 'sr_selling', name: 'Super Rich ขาย', color: '#FB923C', dash: '4 3' },
    { key: 'our_min', name: 'เรทเรา ต่ำสุด', color: '#60A5FA', dash: '' },
    { key: 'our_max', name: 'เรทเรา สูงสุด', color: '#2563EB', dash: '' },
] as const

const RANGE_OPTIONS = [
    { label: '7 วัน', days: 7 },
    { label: '14 วัน', days: 14 },
    { label: '1 เดือน', days: 30 },
    { label: '3 เดือน', days: 90 },
    { label: '6 เดือน', days: 180 },
    { label: '1 ปี', days: 365 },
]

const isoDay = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Rates span 0.02 (KRW) to 44 (GBP) — adapt precision to magnitude.
const formatRate = (v: number | null | undefined) => {
    if (v === null || v === undefined) return '-'
    const abs = Math.abs(v)
    const digits = abs >= 100 ? 2 : abs >= 1 ? 3 : 4
    return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

const shortDay = (day: string) => {
    const [, m, d] = day.split('-')
    return `${Number(d)}/${Number(m)}`
}

function useIsMobile() {
    const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)
    useEffect(() => {
        const onResize = () => setMobile(window.innerWidth < 640)
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])
    return mobile
}

export default function RateHistoryPage() {
    const [currencies, setCurrencies] = useState<PeterExchangeRate[]>([])
    const [code, setCode] = useState<string>('USD')
    const [rangeDays, setRangeDays] = useState<number>(30)
    const [rows, setRows] = useState<RateHistoryRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const isMobile = useIsMobile()

    // Currency picker options (the 16 board currencies we quote)
    useEffect(() => {
        getRates()
            .then(setCurrencies)
            .catch(() => {/* selector falls back to just USD */ })
    }, [])

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setLoading(true); setError(false)
            try {
                const to = new Date()
                const from = new Date()
                from.setDate(from.getDate() - rangeDays)
                const data = await getRateHistory(code, isoDay(from), isoDay(to))
                if (!cancelled) setRows(data)
            } catch {
                if (!cancelled) setError(true)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [code, rangeDays])

    const chartData = useMemo(
        () => rows.map(r => ({ ...r, label: shortDay(r.day) })),
        [rows]
    )

    // Summary over the loaded window
    const summary = useMemo(() => {
        const our = rows.filter(r => r.our_min !== null)
        const totalTxns = rows.reduce((s, r) => s + (r.count || 0), 0)
        const latest = rows[rows.length - 1]
        const ourLow = our.length ? Math.min(...our.map(r => r.our_min as number)) : null
        const ourHigh = our.length ? Math.max(...our.map(r => r.our_max as number)) : null
        return { totalTxns, latest, ourLow, ourHigh, daysWithSales: our.length }
    }, [rows])

    const currencyLabel = useMemo(() => {
        const c = currencies.find(x => x.Cur === code)
        return c ? `${c.Cur} · ${c.Currency}` : code
    }, [currencies, code])

    return (
        <div className="root-vault min-h-screen">
            <div className="flex-1 p-4 sm:p-6 w-full mx-auto space-y-5">
                <div>
                    <h1 className="font-display text-xl font-bold" style={{ color: 'var(--vault-paper)' }}>ประวัติเรท</h1>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--vault-muted)' }}>
                        เทียบเรท Super Rich รายวัน กับช่วงเรทที่เราตั้งจริง (จากรายการซื้อขาย)
                    </p>
                </div>

                {/* Controls */}
                <div className="rounded-2xl p-4 sm:p-5 flex flex-wrap items-center gap-3" style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)' }}>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold" style={{ color: 'var(--vault-muted)' }}>สกุลเงิน</label>
                        <select
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="px-4 py-2 rounded-xl text-sm font-medium focus:outline-none focus:ring-2"
                            style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)', color: 'var(--vault-paper)' }}
                        >
                            {(currencies.length ? currencies : [{ id: 0, Cur: 'USD', Currency: 'US Dollar', Rate: null }]).map(c => (
                                <option key={c.id} value={c.Cur ?? ''}>{c.Cur} · {c.Currency}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold" style={{ color: 'var(--vault-muted)' }}>ช่วงเวลา</label>
                        <div className="flex flex-wrap rounded-xl p-0.5" style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)' }}>
                            {RANGE_OPTIONS.map(opt => (
                                <button
                                    key={opt.days}
                                    onClick={() => setRangeDays(opt.days)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                    style={rangeDays === opt.days
                                        ? { backgroundColor: 'var(--vault-brass)', color: 'var(--vault-brass-ink)' }
                                        : { color: 'var(--vault-muted)' }}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Summary tiles */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatTile label="Super Rich ขาย (ล่าสุด)" value={formatRate(summary.latest?.sr_selling)} />
                    <StatTile label="Super Rich รับซื้อ (ล่าสุด)" value={formatRate(summary.latest?.sr_buying)} />
                    <StatTile label="เรทเรา ต่ำสุด–สูงสุด (ช่วงนี้)" value={summary.ourLow !== null ? `${formatRate(summary.ourLow)} – ${formatRate(summary.ourHigh)}` : '—'} />
                    <StatTile label="จำนวนรายการ (ช่วงนี้)" value={summary.totalTxns.toLocaleString('th-TH')} />
                </div>

                {/* Chart */}
                <div className="rounded-2xl p-4 sm:p-6" style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)' }}>
                    <h3 className="font-display text-base font-semibold mb-4" style={{ color: 'var(--vault-paper)' }}>
                        {currencyLabel}
                    </h3>
                    <div className="h-[300px] sm:h-[380px] w-full relative">
                        {loading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.65)' }}>
                                <span className="text-xs font-medium" style={{ color: 'var(--vault-muted)' }}>กำลังโหลดข้อมูล…</span>
                            </div>
                        )}
                        {error ? (
                            <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--vault-ink-debit)' }}>โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง</div>
                        ) : (!loading && chartData.length === 0) ? (
                            <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--vault-muted)' }}>ไม่มีข้อมูลในช่วงที่เลือก</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: isMobile ? 8 : 20, left: isMobile ? -6 : 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vault-hairline)" />
                                    <XAxis
                                        dataKey="label" axisLine={false} tickLine={false}
                                        tick={{ fill: 'var(--vault-muted)', fontSize: isMobile ? 10 : 11 }}
                                        dy={8} height={isMobile ? 22 : 28}
                                        interval="preserveStartEnd" minTickGap={isMobile ? 24 : 16}
                                    />
                                    <YAxis
                                        axisLine={false} tickLine={false}
                                        tick={{ fill: 'var(--vault-muted)', fontSize: isMobile ? 10 : 12 }}
                                        tickFormatter={(v) => formatRate(v as number)}
                                        width={isMobile ? 46 : 66}
                                        domain={['auto', 'auto']}
                                    />
                                    <Tooltip
                                        formatter={(value, name) => [formatRate(Number(value)), name as string]}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid var(--vault-hairline)', backgroundColor: 'var(--vault-panel)', color: 'var(--vault-paper)', fontSize: isMobile ? 12 : 13 }}
                                        labelStyle={{ color: 'var(--vault-muted)' }}
                                    />
                                    <Legend wrapperStyle={{ color: 'var(--vault-muted)', fontSize: isMobile ? 11 : 12 }} iconSize={isMobile ? 9 : 14} />
                                    {SERIES.map(s => (
                                        <Line
                                            key={s.key}
                                            type="monotone"
                                            dataKey={s.key}
                                            name={s.name}
                                            stroke={s.color}
                                            strokeWidth={2}
                                            strokeDasharray={s.dash || undefined}
                                            dot={{ r: 2, fill: s.color }}
                                            activeDot={{ r: 5 }}
                                            connectNulls
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                    <p className="mt-3 text-[11px]" style={{ color: 'var(--vault-muted)' }}>
                        เส้นทึบ = เรทที่เราตั้งจริงจากรายการซื้อขาย (ต่ำสุด/สูงสุดของวัน) · เส้นประ = เรทอ้างอิง Super Rich วันนั้น
                    </p>
                </div>
            </div>
        </div>
    )
}

function StatTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl p-3 sm:p-4" style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)' }}>
            <div className="text-[11px] mb-1 leading-tight" style={{ color: 'var(--vault-muted)' }}>{label}</div>
            <div className="font-figure text-base sm:text-lg font-bold tabular-nums" style={{ color: 'var(--vault-paper)' }}>{value}</div>
        </div>
    )
}
