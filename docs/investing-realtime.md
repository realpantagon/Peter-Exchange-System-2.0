# Investing.com reference quotes

Only `/admin2025` connects to Investing.com's public Forexpros WebSocket stream.
Quotes exist in React memory only: no D1 tables, migrations, cron jobs, API keys,
localStorage or rate-history integration. The feed never edits our posted rates
or changes the Super Rich forecast.

- Stream: `wss://streaming.forexpros.com/echo/123/{session}/websocket`
- Subscribe: `{"_event":"bulk-subscribe","tzID":8,"message":"pid-147:%%pid-94:"}`
- Heartbeat every 5 seconds: `{"_event":"heartbeat","data":"h"}`
- SockJS messages contain JSON envelopes with `pid-N::{quote}`.
- `last_numeric` is the market price; `timestamp` is Unix seconds from the source.
- Pair IDs and parsing: `src/lib/investing.ts`.
- Hook lifecycle: `src/hooks/useInvestingRates.ts`.
- Display: `src/components/InvestingQuote.tsx` and `AdminPage.tsx`.

Displayed quotes are normalized to THB per **one** foreign currency unit.
Investing's JPY/THB (1908) is quoted per 100 JPY: divide last, bid, ask and absolute
change by 100; leave percentage change unchanged. Other pairs use one unit.
USD, USD1 and USD2 use the same USD/THB quote (147). These are market quotes,
not banknote buying prices. The editor also displays the source's daily change
and percentage. The Investing logo and quotes are non-clickable.

The socket closes when leaving Admin or hiding the browser tab, and reconnects
when returning. Failed connections retry with backoff capped at 30 seconds.
Quotes older than five minutes are marked as old; disconnected quotes are marked
as disconnected. Missing quotes remain "รอราคา…". Some pairs publish infrequently
or with a delay, so a live connection does not imply every quote is current.

This is an **unofficial** endpoint, not a supported Investing.com public API.
The protocol/IDs may change. References used to locate the public feed:

- https://github.com/odrail/investing-com-api/blob/master/src/api/RealTimeData.ts
- https://github.com/alvarobartt/investpy/blob/master/investpy/resources/currency_crosses.csv
- https://th.investing.com/currencies/usd-thb

Verified live USD/THB updates in Chrome on 2026-09-22, including inside the editor.
