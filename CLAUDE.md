# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A currency-exchange rate board + back-office for a Thai exchange shop (Peter Exchange). A React 19 + TypeScript + Vite SPA (Tailwind v4) whose data lives in **Cloudflare D1** and is reached through a **Cloudflare Worker** (`worker/src/index.js`, Hono). The Worker both serves the built SPA and exposes the API — one deployment, no Cloudflare Pages, no separate backend. The Worker also scrapes competitor (Super Rich) rates on a daily cron.

There are **no tests** and no test runner configured.

## Commands

```sh
pnpm dev            # app (5173) + Worker (8787, --remote D1) together, via concurrently
pnpm dev:web        # only Vite
pnpm dev:worker     # only the Worker (wrangler dev --remote)
pnpm build          # tsc -b && vite build  (this is the typecheck too — run it after changes)
pnpm lint           # eslint
pnpm run deploy     # build the SPA + deploy the Worker (pnpm's own `pnpm deploy` is a DIFFERENT builtin — always use `pnpm run deploy`)
pnpm run deploy:worker   # same as deploy; the canonical deploy path
pnpm db:apply       # apply pending D1 migrations (migrations/) to remote
pnpm db:console "SQL"    # run one SQL statement against remote D1
```

- `dev` and `dev:worker` run against the **remote (production) D1** — reads show real data, and writes hit production. There is no seeded local DB.
- Two Cloudflare accounts are reachable from a normal login, so `wrangler` commands need an account id. `worker/wrangler.toml` pins `account_id`; the `db:*` scripts pass `worker/wrangler.env` (holds `CLOUDFLARE_ACCOUNT_ID`, not a secret). For ad-hoc `wrangler` calls, export `CLOUDFLARE_ACCOUNT_ID=b76e4b50bfd52760bbbfec7ff7fc89c0`.

## Environment / secrets

The API is guarded by a shared key that must match in three places:
- `.env` → `VITE_API_KEY` (baked into the client bundle at build time)
- `worker/.dev.vars` → `API_KEY` (local `wrangler dev`)
- production Worker secret `API_KEY` (`pnpm secret:api-key`)

Both `.env` and `worker/.dev.vars` are gitignored. A build with a missing/mismatched `VITE_API_KEY` produces a bundle whose `/api/*` calls all 401.

## Architecture

**Request routing (the key gotcha).** `worker/wrangler.toml` declares `[assets]` with `run_worker_first = [...]` listing the exact paths the Worker handles (`/api/*`, `/trigger`, `/backfill`, `/latest`, `/rates`, `/stats`, `/snapshot-forecast`). **Any path not in that list is served as a static asset (SPA fallback → index.html), NOT by the Worker.** When you add a new non-`/api` Worker route, you must add it to `run_worker_first` or it will silently return the SPA HTML. Prefer putting new endpoints under `/api/*` (already covered + authenticated).

**Two API surfaces in the Worker:**
- `app.route('/api', api)` — the app's data API, every route behind an `X-API-Key` middleware. This is what the SPA calls.
- `app.get('/trigger' | '/backfill' | '/latest' | '/rates' | '/stats' | '/snapshot-forecast')` — the scraper/maintenance surface, **unauthenticated**, kept on bare paths for manual/cron use.

**Client data layer.** `src/lib/api.ts` is the only place that talks to the Worker. It hits `/api` same-origin (Vite proxies `/api` → `:8787` in dev) with the `X-API-Key` header, and — importantly — **maps D1's snake_case columns and numeric types back to the original Supabase-era PascalCase/string shapes** (`toRate`, `toTransaction`, `toBalanceLog`, `fromTransaction`) that the components still speak. When changing DB columns, update these mappers rather than rippling renames through components.

**D1 tables** (`migrations/`): `board_rates` (our posted rate per currency, edited on /admin2025), `transactions` (the ledger), `cash_balance_log` (append-only opening/closing cash per branch/day), `superrich_rates` (scraped competitor rates, one row per `(created_date, code)`), `rate_forecast_log` (daily forecast snapshots for accuracy tracking). Timestamps are ISO-8601 UTC strings so lexicographic order = chronological. Shop-local days are computed as `date(created_at, '+7 hours')` (Bangkok); see `SHOP_TZ_SHIFT`.

**Routing / layout.** `src/App.tsx`: `/admin2025`, `/rate-history`, `/superadmin2025`, `/root`, `/root/daily` share `AdminLayout` (one persistent sidebar + **all visited pages kept mounted/hidden**, not remounted). Because pages stay mounted, a `useEffect(..., [])` runs only once — to re-run work when the user navigates *back* to a page, key the effect on `location.pathname` (see `AdminPage` forcing a fresh Super Rich scrape on entry). **Hard rule (documented in App.tsx):** `/system2025` (staff POS) and `/` (public rate board) must stay OUTSIDE `AdminLayout` and never link into admin routes — staff must not be able to browse into the back office.

**Scraper (`superrich_rates`).** Super Rich's API returns denominations per currency; `CURRENCY_MAP` picks which denomination(s) map to each stored code (USD is split into USD/USD1/USD2; **SGD is listed twice — a premium 1000-note block ~29 and the regular notes ~25 — and is pinned to the regular note**). `insertRows` UPSERTs on `(created_date, code)`, so re-scraping the same day updates it (do not revert to `INSERT OR IGNORE` — that froze the rate at the first scrape of the day). `backfill(env, from, to, code?)` takes an optional `code` to re-fill a single currency after a mapping fix.

**Forecast.** `computeForecast(env, {code, window, asOf})` produces the "suggested rate to set today": `Super Rich buying − margin`, where margin is the recency-weighted (half-life `MARGIN_HALF_LIFE_DAYS`), outlier-filtered gap between SR buying and **our robust daily low** rate. Outliers are stripped twice — per day (`_robustLow` drops rates >`DAY_OUTLIER_BAND` off the day's median, so a cheap small-bill exchange can't drag it down) and per margin series (median/MAD, `MARGIN_MAD_K`). `snapshotForecast` records the day's forecast into `rate_forecast_log`; `/api/forecast-accuracy` compares logged suggestions against the rate we actually gave (MAE + bias).

**Styling.** Admin/root pages use a "vault" theme driven by CSS variables (`--vault-*`, defined in `src/index.css`); prefer those tokens over hard-coded colors on those pages. Charts use Recharts. Shared loading UI: `src/components/Spinner.tsx` (`Spinner`, `LoadingBlock`).

## Deploying

`main` is the deploy branch. `pnpm run deploy:worker` builds `dist/` and `wrangler deploy`s the Worker (which uploads `dist/` as static assets). Frontend-only changes still go out via this same command (there is no separate frontend deploy). The production URL is a `*.workers.dev` domain plus custom domains on `pantagon.org`.
