import { investingTime, type InvestingRate } from '../lib/investing'

export default function InvestingQuote({ quote, now, connected, expanded = false }: {
    quote?: InvestingRate; now: number; connected: boolean; expanded?: boolean
}) {
    if (!quote) return <span className="text-xs opacity-50">รอราคา…</span>
    const stale = now - quote.quotedAt > 5 * 60000
    const digits = quote.last >= 1 ? 3 : 5
    const format = (n: number | null) => n === null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    return (
        <div className="block leading-tight" style={{ color: 'var(--vault-brass, #b45309)' }}
            title={`Investing.com ${quote.code}/THB · Bid ${format(quote.bid)} / Ask ${format(quote.ask)} · ${investingTime(quote.quotedAt)}`}>
            <span className="font-mono text-sm font-semibold tabular-nums">{format(quote.last)}</span>
            {expanded && quote.change !== null && quote.changePercent !== null && (
                <span className={`ml-2 text-xs ${quote.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {quote.change >= 0 ? '+' : ''}{quote.change.toFixed(digits)} ({quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%)
                </span>
            )}
            <span className="block text-[9px] font-normal opacity-80">{!connected ? 'ขาดการเชื่อมต่อ · ' : stale ? 'ข้อมูลเก่า · ' : ''}{investingTime(quote.quotedAt)}</span>
        </div>
    )
}
