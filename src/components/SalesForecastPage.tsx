import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
    ComposedChart, Line, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { getSalesForecast, getSalesBacktest, type SalesForecast, type SalesBacktest } from '../lib/api'
import Spinner from './Spinner'

const BRANCHES = [
    { value: '', label: 'ทุกสาขา' },
    { value: '4', label: 'ร้าน 4' },
    { value: '11', label: 'ร้าน 11' },
]
const DOW_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์']

// Muted, palette-friendly semantic colors (the pure green/red read too loud).
const C_GOOD = '#3E9D6E'
const C_BAD = '#C46A6A'
const C_WARN = '#C08A3E'
const C_NORMAL = '#6C8CD5'

const formatTHB = (v: number) => `฿${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(v)}`
const compact = (v: number) => {
    if (Math.abs(v) >= 1e6) return `฿${(v / 1e6).toFixed(1)}M`
    if (Math.abs(v) >= 1e3) return `฿${Math.round(v / 1e3)}k`
    return `฿${Math.round(v)}`
}
const shortDay = (day: string) => { const [, m, d] = day.split('-'); return `${Number(d)}/${Number(m)}` }

function useIsMobile() {
    const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)
    useEffect(() => { const f = () => setM(window.innerWidth < 640); addEventListener('resize', f); return () => removeEventListener('resize', f) }, [])
    return m
}

export default function SalesForecastPage() {
    const [branch, setBranch] = useState('')
    const [data, setData] = useState<SalesForecast | null>(null)
    const [backtest, setBacktest] = useState<SalesBacktest | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const isMobile = useIsMobile()

    useEffect(() => {
        let cancelled = false
        setLoading(true); setError(false); setBacktest(null)
        getSalesForecast(branch || undefined, 14)
            .then(d => { if (!cancelled) setData(d) })
            .catch(() => { if (!cancelled) setError(true) })
            .finally(() => { if (!cancelled) setLoading(false) })
        getSalesBacktest(branch || undefined, 90)
            .then(b => { if (!cancelled) setBacktest(b) })
            .catch(() => { if (!cancelled) setBacktest(null) })
        return () => { cancelled = true }
    }, [branch])

    // Forecast vs the previous 7 actual days.
    const delta = useMemo(() => {
        if (!data) return null
        const lastWeek = data.history.slice(-7).reduce((a, h) => a + h.total, 0)
        if (lastWeek <= 0) return null
        return { lastWeek, pct: ((data.summary.next7_total - lastWeek) / lastWeek) * 100 }
    }, [data])

    const next7 = useMemo(() => data?.forecast.slice(0, 7) ?? [], [data])
    const maxNext7 = useMemo(() => Math.max(1, ...next7.map(f => f.predicted)), [next7])
    const firstForecastLabel = useMemo(() => data?.forecast.length ? shortDay(data.forecast[0].day) : undefined, [data])

    const chartData = useMemo(() => {
        if (!data) return []
        const hist = data.history.slice(-30)
        const rows: Record<string, number | string | undefined>[] =
            hist.map(h => ({ label: shortDay(h.day), actual: h.total }))
        if (rows.length) {
            const lastTotal = hist[hist.length - 1].total
            const last = rows[rows.length - 1]
            last.predicted = lastTotal; last.low = lastTotal; last.band = 0
        }
        data.forecast.forEach(f => rows.push({ label: shortDay(f.day), predicted: f.predicted, low: f.low, band: f.high - f.low }))
        return rows
    }, [data])

    const btData = useMemo(() =>
        (backtest?.points ?? []).map(p => ({
            label: shortDay(p.day), actual: p.actual, predicted: p.predicted, low: p.low, band: p.high - p.low,
        })), [backtest])

    const busiest = useMemo(() => data?.weekday.length ? [...data.weekday].sort((a, b) => b.factor - a.factor)[0] : null, [data])
    const quietest = useMemo(() => data?.weekday.length ? [...data.weekday].sort((a, b) => a.factor - b.factor)[0] : null, [data])

    const verdict = useMemo(() => {
        const h = backtest?.hit_rate
        if (h == null) return null
        if (h >= 80) return { text: 'ทำนายได้ดี', sub: 'ยอดจริงส่วนใหญ่อยู่ในช่วงที่คาดไว้', color: C_GOOD, good: true }
        if (h >= 60) return { text: 'พอใช้', sub: 'ผันผวนบ้างตามธรรมชาติของยอดรายวัน', color: C_WARN, good: false }
        return { text: 'ยังคลาดเคลื่อนสูง', sub: 'ควรปรับโมเดลเพิ่มเติม', color: C_BAD, good: false }
    }, [backtest])

    const chartTooltip = {
        contentStyle: { borderRadius: '12px', border: '1px solid var(--vault-hairline)', backgroundColor: 'var(--vault-panel)', color: 'var(--vault-paper)', fontSize: isMobile ? 12 : 13, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' },
        labelStyle: { color: 'var(--vault-muted)' },
    }

    return (
        <div className="root-vault min-h-screen">
            <div className="flex-1 p-4 sm:p-6 w-full mx-auto space-y-5">
                {/* Header */}
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <div className="text-[11px] font-semibold tracking-wider uppercase mb-1" style={{ color: 'var(--vault-brass)' }}>Forecast · พยากรณ์</div>
                        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--vault-paper)' }}>ทำนายยอดขาย</h1>
                    </div>
                    <div className="flex rounded-xl p-0.5" style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)' }}>
                        {BRANCHES.map(b => (
                            <button key={b.value} onClick={() => setBranch(b.value)}
                                className="px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all"
                                style={branch === b.value ? { backgroundColor: 'var(--vault-brass)', color: 'var(--vault-brass-ink)' } : { color: 'var(--vault-muted)' }}>
                                {b.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading && !data ? (
                    <div className="rounded-3xl py-20 flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)', color: 'var(--vault-muted)' }}>
                        <Spinner size={24} /><span className="text-sm font-medium">กำลังคำนวณการพยากรณ์…</span>
                    </div>
                ) : error ? (
                    <div className="rounded-3xl py-20 text-center text-sm" style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)', color: 'var(--vault-ink-debit)' }}>โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง</div>
                ) : data && (
                    <>
                        {/* Hero: next 7 days */}
                        <div className="rounded-3xl p-5 sm:p-7 relative overflow-hidden"
                            style={{ background: 'linear-gradient(135deg, var(--vault-brass-tint), var(--vault-panel) 60%)', border: '1px solid var(--vault-brass-border)' }}>
                            <div className="flex flex-wrap items-end justify-between gap-4">
                                <div>
                                    <div className="text-sm font-medium mb-1" style={{ color: 'var(--vault-muted)' }}>คาดยอดขายรวม 7 วันข้างหน้า</div>
                                    <div className="font-figure text-4xl sm:text-5xl font-bold tabular-nums leading-none" style={{ color: 'var(--vault-paper)' }}>
                                        {formatTHB(data.summary.next7_total)}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm">
                                        <span style={{ color: 'var(--vault-muted)' }}>เฉลี่ย <b style={{ color: 'var(--vault-paper)' }}>{formatTHB(data.summary.avg_per_day)}</b>/วัน</span>
                                        {delta && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold"
                                                style={{ backgroundColor: delta.pct >= 0 ? `${C_GOOD}1f` : `${C_BAD}1f`, color: delta.pct >= 0 ? C_GOOD : C_BAD }}>
                                                {delta.pct >= 0 ? '▲' : '▼'} {Math.abs(delta.pct).toFixed(1)}% เทียบสัปดาห์ก่อน
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2 text-right">
                                    <MiniStat label="วันขายดีสุด" value={busiest?.name ?? '—'} sub={busiest ? `×${busiest.factor}` : ''} tone={C_GOOD} />
                                    <MiniStat label="วันเงียบสุด" value={quietest?.name ?? '—'} sub={quietest ? `×${quietest.factor}` : ''} tone={C_BAD} />
                                </div>
                            </div>
                        </div>

                        {/* Next 7 days, day by day (vertical list — symmetric on every screen) */}
                        <div>
                            <SectionLabel>รายวัน · 7 วันข้างหน้า</SectionLabel>
                            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)' }}>
                                {next7.map((f, i) => {
                                    const isPeak = f.predicted === maxNext7
                                    const pct = Math.max(5, Math.round((f.predicted / maxNext7) * 100))
                                    return (
                                        <div key={f.day} className="flex items-center gap-3 sm:gap-4 px-4 py-3"
                                            style={{ borderTop: i ? '1px solid var(--vault-hairline)' : 'none', backgroundColor: isPeak ? 'var(--vault-brass-tint)' : 'transparent' }}>
                                            <div className="w-24 sm:w-28 shrink-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-sm font-bold" style={{ color: isPeak ? 'var(--vault-brass)' : 'var(--vault-paper)' }}>{DOW_FULL[f.dow]}</span>
                                                    {i === 0 && <span className="text-[9px] font-bold px-1 py-px rounded" style={{ backgroundColor: 'var(--vault-brass)', color: 'var(--vault-brass-ink)' }}>พรุ่งนี้</span>}
                                                </div>
                                                <div className="text-[11px] font-figure mt-0.5" style={{ color: 'var(--vault-muted)' }}>{shortDay(f.day)}</div>
                                            </div>
                                            <div className="flex-1 min-w-0 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--vault-hairline)' }}>
                                                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: isPeak ? 'var(--vault-brass)' : 'var(--vault-branch-blue)', opacity: isPeak ? 1 : 0.55 }} />
                                            </div>
                                            <div className="w-16 sm:w-20 text-right font-figure text-base font-bold tabular-nums shrink-0" style={{ color: isPeak ? 'var(--vault-brass)' : 'var(--vault-paper)' }}>{compact(f.predicted)}</div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Actual + forecast chart */}
                        <div className="rounded-2xl p-4 sm:p-6" style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)' }}>
                            <div className="flex items-center justify-between mb-4">
                                <SectionLabel className="mb-0">ยอดขายจริง → คาดการณ์</SectionLabel>
                                <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--vault-muted)' }}>
                                    <Legend color="#2563EB">จริง</Legend>
                                    <Legend color="#D97706" dashed>คาด</Legend>
                                </div>
                            </div>
                            <div className="h-[280px] sm:h-[360px] w-full relative">
                                {loading && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.6)', color: 'var(--vault-muted)' }}>
                                        <Spinner size={20} />
                                    </div>
                                )}
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData} margin={{ top: 5, right: isMobile ? 6 : 16, left: isMobile ? -4 : 8, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#2563EB" stopOpacity={0.22} />
                                                <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vault-hairline)" />
                                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--vault-muted)', fontSize: isMobile ? 9 : 11 }} interval="preserveStartEnd" minTickGap={isMobile ? 22 : 14} dy={6} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--vault-muted)', fontSize: isMobile ? 9 : 11 }} tickFormatter={(v) => compact(v as number)} width={isMobile ? 40 : 54} />
                                        <Tooltip formatter={(value, name) => [formatTHB(Number(value)), name as string]} {...chartTooltip} />
                                        {firstForecastLabel && (
                                            <ReferenceLine x={firstForecastLabel} stroke="var(--vault-brass)" strokeDasharray="3 3" strokeOpacity={0.5}
                                                label={{ value: 'วันนี้', position: 'insideTopRight', fill: 'var(--vault-brass)', fontSize: 10, fontWeight: 700 }} />
                                        )}
                                        <Area dataKey="low" stackId="band" stroke="none" fill="none" isAnimationActive={false} legendType="none" name="ขอบล่าง" />
                                        <Area dataKey="band" stackId="band" stroke="none" fill="#D97706" fillOpacity={0.13} isAnimationActive={false} legendType="none" name="ช่วงคาดการณ์" />
                                        <Area dataKey="actual" stroke="none" fill="url(#actualFill)" isAnimationActive={false} legendType="none" name="ยอดขายจริง" connectNulls={false} />
                                        <Line type="monotone" dataKey="actual" name="ยอดขายจริง" stroke="#2563EB" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} connectNulls />
                                        <Line type="monotone" dataKey="predicted" name="คาดการณ์" stroke="#D97706" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 2, fill: '#D97706' }} activeDot={{ r: 5 }} connectNulls />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Backtest */}
                        {backtest && backtest.n > 0 && (
                            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)' }}>
                                {verdict && (
                                    <div className="flex items-center gap-3.5 px-4 sm:px-6 py-4" style={{ borderBottom: '1px solid var(--vault-hairline)' }}>
                                        <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${verdict.color}1a`, color: verdict.color }}>
                                            {verdict.good ? (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                            ) : (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                                            )}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="font-display font-bold" style={{ color: 'var(--vault-paper)' }}>{verdict.text}</div>
                                            <div className="text-xs" style={{ color: 'var(--vault-muted)' }}>{verdict.sub} · ทดสอบย้อนหลัง {backtest.n} วัน</div>
                                        </div>
                                        <div className="ml-auto text-right shrink-0 pl-3" style={{ borderLeft: '1px solid var(--vault-hairline)' }}>
                                            <div className="font-figure text-2xl font-bold tabular-nums leading-none" style={{ color: verdict.color }}>{backtest.hit_rate}%</div>
                                            <div className="text-[10px] mt-1" style={{ color: 'var(--vault-muted)' }}>ตรงตามคาด</div>
                                        </div>
                                    </div>
                                )}
                                <div className="p-4 sm:p-6">
                                    <div className="grid grid-cols-3 gap-3 mb-5">
                                        <MetricPill label="พลาดเฉลี่ย" value={backtest.mape != null ? `${backtest.mape}%` : '—'} />
                                        <MetricPill label="พลาดเป็นเงิน" value={backtest.mae != null ? `±${compact(backtest.mae)}` : '—'} />
                                        <MetricPill label="เอนเอียง" value={backtest.bias != null ? `${backtest.bias >= 0 ? '+' : '−'}${compact(Math.abs(backtest.bias))}` : '—'} tone={backtest.bias != null && backtest.bias >= 0 ? C_NORMAL : C_BAD} />
                                    </div>
                                    <div className="h-[220px] sm:h-[280px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={btData} margin={{ top: 5, right: isMobile ? 6 : 16, left: isMobile ? -4 : 8, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vault-hairline)" />
                                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--vault-muted)', fontSize: isMobile ? 9 : 11 }} interval="preserveStartEnd" minTickGap={isMobile ? 22 : 14} dy={6} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--vault-muted)', fontSize: isMobile ? 9 : 11 }} tickFormatter={(v) => compact(v as number)} width={isMobile ? 40 : 54} />
                                                <Tooltip formatter={(value, name) => [formatTHB(Number(value)), name as string]} {...chartTooltip} />
                                                <Area dataKey="low" stackId="bt" stroke="none" fill="none" isAnimationActive={false} legendType="none" name="ขอบล่าง" />
                                                <Area dataKey="band" stackId="bt" stroke="none" fill="#D97706" fillOpacity={0.12} isAnimationActive={false} legendType="none" name="ช่วงคาด" />
                                                <Line type="monotone" dataKey="predicted" name="คาดการณ์" stroke="#D97706" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                                                <Line type="monotone" dataKey="actual" name="ยอดจริง" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 2, fill: '#2563EB' }} activeDot={{ r: 5 }} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <p className="mt-3 text-[11px]" style={{ color: 'var(--vault-muted)' }}>
                                        ทดสอบด้วยข้อมูลก่อนหน้าแต่ละวันเท่านั้น (ไม่โกง) · ยอดรายวันผันผวนสูงเป็นธรรมชาติ จึงดูทิศทาง/ระดับมากกว่าตัวเลขเป๊ะรายวัน
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Weekday pattern */}
                        <div className="rounded-2xl p-4 sm:p-6" style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)' }}>
                            <SectionLabel>รูปแบบยอดขายตามวันในสัปดาห์</SectionLabel>
                            <div className="h-[180px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.weekday} margin={{ top: 5, right: 8, left: isMobile ? -6 : 8, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vault-hairline)" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--vault-muted)', fontSize: 12 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--vault-muted)', fontSize: isMobile ? 9 : 11 }} tickFormatter={(v) => compact(v as number)} width={isMobile ? 40 : 54} />
                                        <Tooltip formatter={(v) => [formatTHB(Number(v)), 'เฉลี่ย/วัน']} {...chartTooltip} />
                                        <Bar dataKey="avg" radius={[6, 6, 0, 0]} maxBarSize={44}>
                                            {data.weekday.map((w) => (
                                                <Cell key={w.dow} fill={w.factor >= 1.1 ? C_GOOD : w.factor <= 0.9 ? C_BAD : C_NORMAL} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px]" style={{ color: 'var(--vault-muted)' }}>
                                <Legend color={C_GOOD}>วันขายดี (×≥1.1)</Legend>
                                <Legend color={C_NORMAL}>ปกติ</Legend>
                                <Legend color={C_BAD}>วันเงียบ (×≤0.9)</Legend>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <div className={`text-[11px] font-semibold tracking-wider uppercase mb-3 ${className}`} style={{ color: 'var(--vault-muted)' }}>{children}</div>
}

function MiniStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) {
    return (
        <div className="rounded-xl px-3 py-2" style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)' }}>
            <div className="text-[10px]" style={{ color: 'var(--vault-muted)' }}>{label}</div>
            <div className="font-bold text-sm" style={{ color: tone }}>{value} <span className="font-figure text-[11px] font-normal">{sub}</span></div>
        </div>
    )
}

function MetricPill({ label, value, tone }: { label: string; value: string; tone?: string }) {
    return (
        <div className="rounded-xl px-3 py-2.5 text-center" style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)' }}>
            <div className="font-figure text-lg font-bold tabular-nums" style={{ color: tone ?? 'var(--vault-paper)' }}>{value}</div>
            <div className="text-[10px]" style={{ color: 'var(--vault-muted)' }}>{label}</div>
        </div>
    )
}

function Legend({ color, dashed, children }: { color: string; dashed?: boolean; children: ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span style={{ display: 'inline-block', width: 14, height: 0, borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}` }} />
            {children}
        </span>
    )
}
