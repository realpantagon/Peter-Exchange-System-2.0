# Peter Exchange System 2.0

A currency exchange rate display and back-office management system, built with React, TypeScript, Vite, and Cloudflare (Workers + D1).

## Tech stack

- React 19 + React Router 7
- TypeScript + Vite 7
- Tailwind CSS 4
- Cloudflare Worker (Hono) serving both the API and the built app
- Cloudflare D1 (SQLite) for all data
- Recharts for charts, html2canvas for exports

## Architecture

One Worker (`peter-exchange`) does three jobs:

1. Serves the built SPA from `dist/` as static assets.
2. Serves the business API under `/api/*`, backed by D1.
3. Scrapes Super Rich rates daily on a cron trigger (`0 2 * * *` UTC = 09:00 ICT).

Because the app and the API share an origin, there is no CORS to configure. In
development Vite proxies `/api` to `wrangler dev`, so the path is identical in
both environments.

The browser never talks to D1 directly. [`src/lib/api.ts`](src/lib/api.ts) is the
only place that calls the API, and it also maps D1's snake_case rows onto the
shapes the components expect.

## Routes

| Path              | Page                                      |
| ----------------- | ----------------------------------------- |
| `/`                | Public exchange rate display              |
| `/admin2025`       | Admin panel                                |
| `/system2025`      | System panel                               |
| `/superadmin2025`  | Super admin panel                          |
| `/root`             | Root: branch cash / opening-closing rounds |
| `/root/daily`      | Root: daily balance detail                 |

## API

All `/api/*` routes require an `X-API-Key` header matching the Worker's
`API_KEY` secret.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/rates` | Board rates, one row per currency |
| `PATCH` | `/api/rates/:id` | Update a rate |
| `GET` | `/api/transactions?from=&to=&branch=` | Transactions, newest first |
| `POST` `PATCH` `DELETE` | `/api/transactions[/:id]` | Create / edit / remove |
| `GET` | `/api/balance-logs?date=&branch=` | Cash balance log, oldest first |
| `POST` `PATCH` `DELETE` | `/api/balance-logs[/:id]` | Create / edit / remove |

The scraper keeps its original unauthenticated paths: `/trigger`,
`/backfill?from=&to=`, `/latest`, `/rates?code=&limit=`, `/stats`.

## Getting started

1. Install dependencies:

   ```sh
   pnpm install
   ```

   On the first install, pnpm will ask you to approve build scripts for `esbuild`
   and `usb` (native/postinstall scripts). Run:

   ```sh
   pnpm approve-builds --all
   ```

   and re-run `pnpm install` afterwards. This only needs to be done once per machine.

2. Set the API key. It must be the same value in three places:

   ```env
   # .env  (frontend)
   VITE_API_KEY=your-shared-secret
   ```

   ```env
   # worker/.dev.vars  (wrangler dev)
   API_KEY=your-shared-secret
   ```

   ```sh
   # production Worker secret
   pnpm secret:api-key
   ```

3. Start everything with one command — runs the app (5173) and the Worker/API
   (8787) together via `concurrently`:

   ```sh
   pnpm dev
   ```

   Vite proxies `/api` → the Worker, which runs against the **remote** D1
   database (real data). Need them apart? `pnpm dev:web` and `pnpm dev:worker`
   run each half on its own.

## Database

D1 database: `peter-exchange`. Migrations live in [`migrations/`](migrations).

```sh
pnpm db:apply                                   # apply pending migrations to remote
pnpm db:console "SELECT COUNT(*) FROM transactions"
```

Tables:

| Table | Contents |
| --- | --- |
| `board_rates` | The shop's own posted rates, one row per currency |
| `transactions` | Every buy/sell transaction |
| `cash_balance_log` | Append-only opening/closing cash entries per branch per day |
| `superrich_rates` | Competitor rates scraped daily |

`worker/wrangler.env` holds `CLOUDFLARE_ACCOUNT_ID` (not a secret). It exists
because `wrangler d1 *` ignores the `account_id` field in `wrangler.toml` and
fails when a login can reach more than one account.

The one-off Supabase import lives in
[`worker/import-supabase-csv.mjs`](worker/import-supabase-csv.mjs) and is kept
for reference — it is not part of the normal workflow.

## Scripts

- `pnpm dev` — start the app (5173) **and** the Worker/API (8787) together
- `pnpm dev:web` — start only the Vite dev server
- `pnpm dev:worker` — start only the Worker (API) on port 8787 (remote D1)
- `pnpm build` — type-check and build for production
- `pnpm lint` — run ESLint
- `pnpm preview` — preview the production build locally
- `pnpm deploy:worker` — build, then deploy the Worker (app + API) to Cloudflare
- `pnpm db:apply` — apply pending D1 migrations
- `pnpm db:console "<sql>"` — run a query against remote D1
- `pnpm secret:api-key` — set the Worker's `API_KEY` secret
