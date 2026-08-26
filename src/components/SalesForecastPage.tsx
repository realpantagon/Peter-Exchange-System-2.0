import { useEffect, useMemo, useState } from 'react'
import {
    ComposedChart, Line, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { getSalesForecast, getSalesBacktest, type SalesForecast, type SalesBacktest } from '../lib/api'
import Spinner from './Spinner'

const BRANCHES = [
    { value: '', label: 'ทุกสาขา' },
    { value: '4', label: 'ร้าน 4' },
    { value: '11', label: 'ร้าน 11' },
]

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
        getSalesBacktest(branch || undefined, 30)
            .then(b => { if (!cancelled) setBacktest(b) })
            .catch(() => { if (!cancelled) setBacktest(null) })
        return () => { cancelled = true }
    }, [branch])

    const btData = useMemo(() =>
        (backtest?.points ?? []).map(p => ({
            label: shortDay(p.day), actual: p.actual, predicted: p.predicted, low: p.low, band: p.high - p.low,
        })), [backtest])

    const verdict = useMemo(() => {
        const h = backtest?.hit_rate
        if (h == null) return null
        if (h >= 80) return { text: 'ทำนายได้ดี — ส่วนใหญ่อยู่ในช่วงที่คาด', color: '#16A34A', emoji: '✅' }
        if (h >= 60) return { text: 'พอใช้ — ผันผวนบ้างตามธรรมชาติของยอดรายวัน', color: '#D97706', emoji: '⚠️' }
        return { text: 'ยังคลาดเคลื่อนสูง — ควรปรับโมเดล', color: '#DC2626', emoji: '❗' }
    }, [backtest])

    // Combined chart: last 30 actual days + 14 forecast days, bridged so lines connect.
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

    const busiest = useMemo(() => {
        if (!data?.weekday.length) return null
        return [...data.weekday].sort((a, b) => b.factor - a.factor)[0]
    }, [data])
    const quietest = useMemo(() => {
        if (!data?.weekday.length) return null
        return [...data.weekday].sort((a, b) => a.factor - b.factor)[0]
    }, [data])

    return (
        <div className="root-vault min-h-screen">
            <div className="flex-1 p-4 sm:p-6 w-full mx-auto space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="font-display text-xl font-bold" style={{ color: 'var(--vault-paper)' }}>ทำนายยอดขาย</h1>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--vault-muted)' }}>
                            คาดการณ์ยอดแลกเงินรายวัน 14 วันข้างหน้า จากแนวโน้มล่าสุด × รูปแบบวันในสัปดาห์
                        </p>
                    </div>
                    <div className="flex rounded-xl p-0.5" style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)' }}>
                        {BRANCHES.map(b => (
                            <button
                                key={b.value}
                                onClick={() => setBranch(b.value)}
                                className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                                style={branch === b.value
                                    ? { backgroundColor: 'var(--vault-brass)', color: 'var(--vault-brass-ink)' }
                                    : { color: 'var(--vault-muted)' }}
                            >
                                {b.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Summary tiles */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Tile label="คาดยอดขาย 7 วันข้างหน้า" value={data ? formatTHB(data.summary.next7_total) : '—'} accent="var(--vault-brass)" />
                    <Tile label="เฉลี่ยต่อวัน" value={data ? formatTHB(data.summary.avg_per_day) : '—'} />
                    <Tile label="วันขายดีสุด" value={busiest ? `${busiest.name} (×${busiest.factor})` : '—'} accent="#16A34A" />
                    <Tile label="วันเงียบสุด" value={quietest ? `${quietest.name} (×${quietest.factor})` : '—'} accent="#DC2626" />
                </div>

                {/* Main forecast chart */}
                <div className="rounded-2xl p-4 sm:p-6" style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)' }}>
                    <h3 className="font-display text-base font-semibold mb-4" style={{ color: 'var(--vault-paper)' }}>
                        ยอดขายจริง + คาดการณ์ {data ? `· ${BRANCHES.find(b => b.value === branch)?.label}` : ''}
                    </h3>
                    <div className="h-[300px] sm:h-[380px] w-full relative">
                        {loading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.65)', color: 'var(--vault-muted)' }}>
                                <Spinner size={22} /><span className="text-xs font-medium">กำลังโหลด…</span>
                            </div>
                        )}
                        {error ? (
                            <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--vault-ink-debit)' }}>โหลดข้อมูลไม่สำเร็จ</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 5, right: isMobile ? 6 : 16, left: isMobile ? -4 : 8, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vault-hairline)" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false}
                                        tick={{ fill: 'var(--vault-muted)', fontSize: isMobile ? 9 : 11 }}
                                        interval="preserveStartEnd" minTickGap={isMobile ? 22 : 14} dy={6} />
                                    <YAxis axisLine={false} tickLine={false}
                                        tick={{ fill: 'var(--vault-muted)', fontSize: isMobile ? 9 : 11 }}
                                        tickFormatter={(v) => compact(v as number)} width={isMobile ? 40 : 54} />
                                    <Tooltip
                                        formatter={(value, name) => [formatTHB(Number(value)), name as string]}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid var(--vault-hairline)', backgroundColor: 'var(--vault-panel)', color: 'var(--vault-paper)', fontSize: isMobile ? 12 : 13 }}
                                        labelStyle={{ color: 'var(--vault-muted)' }} />
                                    {/* Uncertainty band (low → high), drawn as a floating stacked area */}
                                    <Area dataKey="low" stackId="band" stroke="none" fill="none" isAnimationActive={false} legendType="none" name="ขอบล่าง" />
                                    <Area dataKey="band" stackId="band" stroke="none" fill="#D97706" fillOpacity={0.13} isAnimationActive={false} legendType="none" name="ช่วงคาดการณ์" />
                                    <Line type="monotone" dataKey="actual" name="ยอดขายจริง" stroke="#2563EB" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} connectNulls />
                                    <Line type="monotone" dataKey="predicted" name="คาดการณ์" stroke="#D97706" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 2, fill: '#D97706' }} activeDot={{ r: 5 }} connectNulls />
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                    <p className="mt-3 text-[11px]" style={{ color: 'var(--vault-muted)' }}>
                        เส้นน้ำเงิน = ยอดขายจริง · เส้นประส้ม = คาดการณ์ · แถบส้มจาง = ช่วงความคลาดเคลื่อน (±1σ)
                    </p>
                </div>

                {/* Backtest — did past forecasts meet expectations? */}
                {backtest && backtest.n > 0 && (
                    <div className="rounded-2xl p-4 sm:p-6" style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)' }}>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <h3 className="font-display text-base font-semibold" style={{ color: 'var(--vault-paper)' }}>ผลย้อนหลัง — ทำนายแม่นแค่ไหน?</h3>
                            <span className="text-xs" style={{ color: 'var(--vault-muted)' }}>ทดสอบ {backtest.n} วัน (ใช้เฉพาะข้อมูลก่อนหน้าแต่ละวัน)</span>
                        </div>
                        {verdict && (
                            <p className="text-sm font-semibold mb-4" style={{ color: verdict.color }}>{verdict.emoji} {verdict.text}</p>
                        )}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                            <Tile label="ตรงตามคาด (อยู่ในช่วง ±1σ)" value={backtest.hit_rate != null ? `${backtest.hit_rate}%` : '—'} accent="#16A34A" />
                            <Tile label="พลาดเฉลี่ย (MAPE)" value={backtest.mape != null ? `${backtest.mape}%` : '—'} />
                            <Tile label="พลาดเฉลี่ย (บาท)" value={backtest.mae != null ? `±${formatTHB(backtest.mae)}` : '—'} />
                            <Tile label="เอนเอียง" value={backtest.bias != null ? `${backtest.bias >= 0 ? 'สูงไป +' : 'ต่ำไป −'}${formatTHB(Math.abs(backtest.bias))}` : '—'} accent={backtest.bias != null && backtest.bias >= 0 ? '#2563EB' : '#DC2626'} />
                        </div>
                        <div className="h-[240px] sm:h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={btData} margin={{ top: 5, right: isMobile ? 6 : 16, left: isMobile ? -4 : 8, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vault-hairline)" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--vault-muted)', fontSize: isMobile ? 9 : 11 }} interval="preserveStartEnd" minTickGap={isMobile ? 22 : 14} dy={6} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--vault-muted)', fontSize: isMobile ? 9 : 11 }} tickFormatter={(v) => compact(v as number)} width={isMobile ? 40 : 54} />
                                    <Tooltip formatter={(value, name) => [formatTHB(Number(value)), name as string]}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid var(--vault-hairline)', backgroundColor: 'var(--vault-panel)', color: 'var(--vault-paper)', fontSize: isMobile ? 12 : 13 }}
                                        labelStyle={{ color: 'var(--vault-muted)' }} />
                                    <Area dataKey="low" stackId="bt" stroke="none" fill="none" isAnimationActive={false} legendType="none" name="ขอบล่าง" />
                                    <Area dataKey="band" stackId="bt" stroke="none" fill="#D97706" fillOpacity={0.12} isAnimationActive={false} legendType="none" name="ช่วงคาด" />
                                    <Line type="monotone" dataKey="predicted" name="คาดการณ์" stroke="#D97706" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                                    <Line type="monotone" dataKey="actual" name="ยอดจริง" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 2, fill: '#2563EB' }} activeDot={{ r: 5 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="mt-3 text-[11px]" style={{ color: 'var(--vault-muted)' }}>
                            "ตรงตามคาด" = ยอดจริงตกอยู่ในแถบ ±1σ ของคำทำนาย · ยอดแลกเงินรายวันผันผวนสูงตามธรรมชาติ จึงดูภาพรวม/ทิศทางมากกว่าตัวเลขเป๊ะรายวัน
                        </p>
                    </div>
                )}

                {/* Weekday pattern */}
                <div className="rounded-2xl p-4 sm:p-6" style={{ backgroundColor: 'var(--vault-panel)', border: '1px solid var(--vault-hairline)' }}>
                    <h3 className="font-display text-base font-semibold mb-1" style={{ color: 'var(--vault-paper)' }}>รูปแบบยอดขายตามวัน</h3>
                    <p className="text-xs mb-4" style={{ color: 'var(--vault-muted)' }}>ยอดเฉลี่ยที่คาดในแต่ละวันของสัปดาห์</p>
                    <div className="h-[180px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.weekday ?? []} margin={{ top: 5, right: 8, left: isMobile ? -6 : 8, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--vault-hairline)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--vault-muted)', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--vault-muted)', fontSize: isMobile ? 9 : 11 }} tickFormatter={(v) => compact(v as number)} width={isMobile ? 40 : 54} />
                                <Tooltip
                                    formatter={(v) => [formatTHB(Number(v)), 'เฉลี่ย/วัน']}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--vault-hairline)', backgroundColor: 'var(--vault-panel)', color: 'var(--vault-paper)', fontSize: 13 }} />
                                <Bar dataKey="avg" radius={[6, 6, 0, 0]} maxBarSize={44}>
                                    {(data?.weekday ?? []).map((w) => (
                                        <Cell key={w.dow} fill={w.factor >= 1.1 ? '#16A34A' : w.factor <= 0.9 ? '#DC2626' : '#2563EB'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    )
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: string }) {
    return (
        <div className="rounded-2xl p-3 sm:p-4" style={{ backgroundColor: 'var(--vault-panel-raised)', border: '1px solid var(--vault-hairline)' }}>
            <div className="text-[11px] mb-1 leading-tight" style={{ color: 'var(--vault-muted)' }}>{label}</div>
            <div className="font-figure text-base sm:text-xl font-bold tabular-nums" style={{ color: accent ?? 'var(--vault-paper)' }}>{value}</div>
        </div>
    )
}
