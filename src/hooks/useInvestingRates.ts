import { useEffect, useState } from 'react'
import { subscribeInvesting, type InvestingConnection, type InvestingRate } from '../lib/investing'

export default function useInvestingRates(active: boolean) {
    const [quotes, setQuotes] = useState<Record<string, InvestingRate>>({})
    const [status, setStatus] = useState<InvestingConnection>('paused')
    const [now, setNow] = useState(Date.now)

    useEffect(() => {
        if (!active) return
        let unsubscribe: (() => void) | undefined
        const updateVisibility = () => {
            unsubscribe?.()
            unsubscribe = undefined
            if (document.hidden) { setStatus('paused'); return }
            unsubscribe = subscribeInvesting(incoming => {
                setNow(Date.now())
                setQuotes(previous => {
                    const next = { ...previous }
                    for (const quote of incoming) {
                        if (!next[quote.code] || next[quote.code].quotedAt <= quote.quotedAt) next[quote.code] = quote
                    }
                    return next
                })
            }, setStatus)
        }
        updateVisibility()
        const clock = setInterval(() => setNow(Date.now()), 15000)
        document.addEventListener('visibilitychange', updateVisibility)
        return () => {
            unsubscribe?.()
            clearInterval(clock)
            document.removeEventListener('visibilitychange', updateVisibility)
        }
    }, [active])

    return { quotes, status: active ? status : 'paused' as InvestingConnection, now }
}
