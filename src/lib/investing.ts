// Public quote stream used by Investing.com (unofficial; may change upstream).
// IDs verified against investpy's currency_crosses.csv and the live stream.
// Normalize to THB per ONE unit. Investing's JPY/THB feed is per 100 JPY.
// USD banknote denominations share one quote.
export const INVESTING_PAIRS: Readonly<Record<string, number>> = {
    USD: 147, EUR: 94, JPY: 1908, GBP: 95, SGD: 2042, AUD: 130,
    CHF: 1558, HKD: 1830, CAD: 1536, NZD: 120, TWD: 2081,
    MYR: 1967, CNY: 9534, KRW: 1925,
}
const codeById = new Map(Object.entries(INVESTING_PAIRS).map(([code, id]) => [String(id), code]))

export interface InvestingRate {
    code: string
    last: number
    bid: number | null
    ask: number | null
    change: number | null
    changePercent: number | null
    quotedAt: number
}

export const investingCurrency = (code: string) => code === 'USD1' || code === 'USD2' ? 'USD' : code
export const investingTime = (time: number) => new Date(time).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
})

const number = (value: unknown): number | null => {
    if (typeof value !== 'string' && typeof value !== 'number') return null
    if (typeof value === 'string' && !value.trim()) return null
    const n = Number(typeof value === 'string' ? value.replaceAll(',', '').replace('%', '') : value)
    return Number.isFinite(n) ? n : null
}
const positive = (value: unknown) => {
    const n = number(value)
    return n !== null && n > 0 ? n : null
}

export function parseInvestingFrame(frame: unknown, now = Date.now()): InvestingRate[] {
    if (typeof frame !== 'string' || !frame.startsWith('a') || frame.length > 65536) return []
    const rows: InvestingRate[] = []
    try {
        const envelopes: unknown = JSON.parse(frame.slice(1))
        if (!Array.isArray(envelopes)) return []
        for (const envelope of envelopes) {
            try {
                if (typeof envelope !== 'string') continue
                const message: unknown = JSON.parse(envelope).message
                if (typeof message !== 'string') continue
                const match = /^pid-(\d+)::(\{.*\})$/.exec(message)
                if (!match) continue
                const q = JSON.parse(match[2])
                const code = codeById.get(match[1])
                const last = positive(q.last_numeric)
                const timestamp = positive(q.timestamp)
                if (!code || String(q.pid) !== match[1] || last === null || timestamp === null) continue
                const quotedAt = timestamp * 1000
                if (quotedAt < Date.UTC(2000, 0, 1) || quotedAt > now + 300000) continue
                let bid = positive(q.bid), ask = positive(q.ask)
                if (bid !== null && ask !== null && bid > ask) { bid = null; ask = null }
                // https://th.investing.com/currencies/jpy-thb: "ราคาคูณกับ 100".
                const units = code === 'JPY' ? 100 : 1
                const change = number(q.pc)
                rows.push({ code, last: last / units,
                    bid: bid === null ? null : bid / units, ask: ask === null ? null : ask / units,
                    quotedAt, change: change === null ? null : change / units, changePercent: number(q.pcp) })
            } catch { /* Skip a malformed envelope without losing the other quotes. */ }
        }
    } catch { /* Heartbeats, control frames and invalid JSON are not quotes. */ }
    return rows
}

export type InvestingConnection = 'connecting' | 'live' | 'reconnecting' | 'paused'

// Only in-memory data. Caller owns lifecycle; no Worker, D1 or browser storage.
export function subscribeInvesting(
    onQuotes: (quotes: InvestingRate[]) => void,
    onStatus: (status: InvestingConnection) => void,
): () => void {
    let disposed = false
    let socket: WebSocket | undefined
    let retry: ReturnType<typeof setTimeout> | undefined
    let heartbeat: ReturnType<typeof setInterval> | undefined
    let watchdog: ReturnType<typeof setInterval> | undefined
    let attempts = 0
    let lastFrameAt = Date.now()

    const stopSocket = () => {
        clearInterval(heartbeat)
        clearInterval(watchdog)
        const old = socket
        socket = undefined
        if (old) {
            old.onopen = old.onmessage = old.onerror = old.onclose = null
            old.close()
        }
    }
    const reconnect = () => {
        if (disposed) return
        stopSocket()
        clearTimeout(retry)
        onStatus('reconnecting')
        retry = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5)))
    }
    const send = (message: object) => {
        try {
            if (!socket) return false
            socket.send(JSON.stringify(message))
            return true
        } catch { reconnect(); return false }
    }
    const connect = () => {
        if (disposed) return
        onStatus(attempts ? 'reconnecting' : 'connecting')
        lastFrameAt = Date.now()
        try {
            const session = crypto.randomUUID().replaceAll('-', '').slice(0, 8)
            socket = new WebSocket(`wss://streaming.forexpros.com/echo/123/${session}/websocket`)
            socket.onopen = () => {
                if (!send({ _event: 'bulk-subscribe', tzID: 8,
                    message: Object.values(INVESTING_PAIRS).map(id => `pid-${id}:`).join('%%') })) return
                heartbeat = setInterval(() => {
                    if (socket?.readyState === WebSocket.OPEN) send({ _event: 'heartbeat', data: 'h' })
                }, 5000)
            }
            socket.onmessage = ({ data }) => {
                lastFrameAt = Date.now()
                if (typeof data === 'string' && data.startsWith('c')) { reconnect(); return }
                const quotes = parseInvestingFrame(data)
                if (quotes.length) {
                    attempts = 0
                    onStatus('live')
                    onQuotes(quotes)
                }
            }
            socket.onerror = reconnect
            socket.onclose = reconnect
            watchdog = setInterval(() => {
                if (Date.now() - lastFrameAt > 30000) reconnect()
            }, 10000)
        } catch { reconnect() }
    }
    connect()
    return () => { disposed = true; clearTimeout(retry); stopSocket() }
}
