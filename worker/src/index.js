import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

// =============================================================================
// Super Rich rate scraper — unchanged behaviour, now mounted on a Hono app.
// =============================================================================

// Super Rich relaunched superrichthailand.com (Aug 2026) on a new Next.js
// site backed by api.superrichthailand.com; the old web/api/v1/rates +
// api/v1/rates/history endpoints now 404. This hits the new public
// exchange-client API instead — no auth header needed, unlike the old one.
// branchId 10 = "Headquarter Rajdamri 1" (branchCode H01), picked because its
// numbers pick up right where the old site-wide feed left off (checked against
// the last superrich_rates row before the switch).
const SUPERRICH_LIST = 'https://api.superrichthailand.com/api/v1/exchange-client/list';
const SUPERRICH_BRANCH_ID = 10;

// Currency filter — only store these codes
// USD is split by denomination into 3 codes
const CURRENCY_MAP = {
  USD: [
    { code: 'USD',  denoms: ['100', '50'] },
    { code: 'USD2', denoms: ['20 - 10', '20-10', '10', '20'] },
    { code: 'USD1', denoms: ['1'] },
  ],
  EUR: [{ code: 'EUR', denoms: null }],
  JPY: [{ code: 'JPY', denoms: null }],
  GBP: [{ code: 'GBP', denoms: null }],
  // SGD is listed twice: a premium 1000-note block (~29) and the regular notes
  // (~25). Pin to the regular note so we track the normal SGD rate, not the 1000.
  SGD: [{ code: 'SGD', denoms: ['100 - 50', '100-50', '100', '50', '20 - 5', '20-5'] }],
  AUD: [{ code: 'AUD', denoms: null }],
  CHF: [{ code: 'CHF', denoms: null }],
  HKD: [{ code: 'HKD', denoms: null }],
  CAD: [{ code: 'CAD', denoms: null }],
  NZD: [{ code: 'NZD', denoms: null }],
  TWD: [{ code: 'TWD', denoms: null }],
  MYR: [{ code: 'MYR', denoms: null }],
  CNY: [{ code: 'CNY', denoms: null }],
  KRW: [{ code: 'KRW', denoms: null }],
};

function extractRows(exchange, createdDate, scrapedAt) {
  const rows = [];
  for (const [unit, denoms] of Object.entries(exchange)) {
    const rules = CURRENCY_MAP[unit];
    if (!rules) continue; // skip currencies not in list

    for (const rule of rules) {
      let rate;
      if (rule.denoms === null) {
        // Take the first (highest) denomination
        rate = denoms[0];
      } else {
        rate = denoms.find((r) => rule.denoms.includes(r.denomRem?.trim()));
      }
      if (!rate) continue;
      rows.push({
        scrapedAt,
        code: rule.code,
        currency: unit,
        countryName: null, // the new API doesn't return this
        denom: rate.denomRem,
        buying: Number(rate.buyText),
        selling: Number(rate.sellText),
        createdDate,
      });
    }
  }
  return rows;
}

async function insertRows(env, rows) {
  if (!rows.length) return;
  // Upsert on (created_date, code): the first scrape of the day inserts, and every
  // later scrape that day (cron re-run or a manual /refresh) UPDATES the same row
  // with the current rate. `INSERT OR IGNORE` used to drop these, so the rate was
  // frozen at whatever the first scrape of the day saw and never moved intraday.
  const stmts = rows.map((r) =>
    env.DB.prepare(
      `INSERT INTO superrich_rates
       (scraped_at, code, currency, country_name, denomination, buying, selling, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(created_date, code) DO UPDATE SET
         scraped_at   = excluded.scraped_at,
         currency     = excluded.currency,
         country_name = excluded.country_name,
         denomination = excluded.denomination,
         buying       = excluded.buying,
         selling      = excluded.selling`
    ).bind(r.scrapedAt, r.code, r.currency, r.countryName, r.denom, r.buying, r.selling, r.createdDate)
  );
  await env.DB.batch(stmts);
}

async function scrapeToday(env) {
  const r = await fetch(`${SUPERRICH_LIST}?branchId=${SUPERRICH_BRANCH_ID}&type=exchange`, {
    headers: { Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`Current API ${r.status}`);
  const json = await r.json();
  if (json.statusCode !== 200) throw new Error(json.message);

  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const rows = extractRows(json.data.exchange, today, now);
  await insertRows(env, rows);
  return { success: true, scraped_at: now, codes_saved: rows.map((r) => r.code) };
}

// `code` (optional): only (re)fill that one currency, and treat a date as missing
// unless THAT code exists for it — lets us re-backfill a single currency (e.g.
// after fixing its denomination mapping) without re-fetching everything else.
async function backfill(env, fromStr, toStr, code) {
  let saved = 0, skipped = 0;
  const errors = [];

  for (let d = new Date(fromStr); d <= new Date(toStr); d.setDate(d.getDate() + 1)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const createdDate = `${yyyy}-${mm}-${dd}`;

    const exists = code
      ? await env.DB.prepare('SELECT 1 FROM superrich_rates WHERE created_date = ? AND code = ? LIMIT 1').bind(createdDate, code).first()
      : await env.DB.prepare('SELECT 1 FROM superrich_rates WHERE created_date = ? LIMIT 1').bind(createdDate).first();
    if (exists) { skipped++; continue; }

    try {
      // type=exchange-history + date=YYYY-MM-DD returns that day's snapshot;
      // the new API doesn't echo back a timestamp for it, so scrapedAt is a placeholder.
      const r = await fetch(`${SUPERRICH_LIST}?branchId=${SUPERRICH_BRANCH_ID}&type=exchange-history&date=${createdDate}`, {
        headers: { Accept: 'application/json' },
      });
      const json = await r.json();
      if (json.statusCode === 200 && json.data?.exchange && Object.keys(json.data.exchange).length) {
        const scrapedAt = `${createdDate}T12:00:00.000Z`;
        let rows = extractRows(json.data.exchange, createdDate, scrapedAt);
        if (code) rows = rows.filter((row) => row.code === code);
        await insertRows(env, rows);
        saved++;
      } else {
        skipped++;
      }
    } catch (e) {
      errors.push(`${createdDate}: ${e.message}`);
    }
  }

  return { success: true, days_saved: saved, days_skipped: skipped, errors };
}

// =============================================================================
// App
// =============================================================================

const app = new Hono();

// --- Business API (/api/*) ---------------------------------------------------
// Guarded by a shared secret. The key ships in the client bundle, so this stops
// drive-by writes rather than a determined attacker — it is still a large step
// up from the Supabase anon key, which allowed anyone to read and write every
// table directly.
const api = new Hono();

api.use('*', async (c, next) => {
  const expected = c.env.API_KEY;
  if (!expected) return c.json({ error: 'API_KEY is not configured on the Worker' }, 500);
  if (c.req.header('X-API-Key') !== expected) return c.json({ error: 'Unauthorized' }, 401);
  await next();
});

// Build a partial UPDATE from whichever allowed fields the body actually carries,
// so a PATCH never clobbers columns the caller did not mention.
function buildPatch(body, allowed) {
  const keys = allowed.filter((k) => body[k] !== undefined);
  return {
    clause: keys.map((k) => `${k} = ?`).join(', '),
    values: keys.map((k) => body[k]),
    isEmpty: keys.length === 0,
  };
}

const nullableText = z.string().nullish();
const nullableNum = z.number().nullish();

// --- Rates -------------------------------------------------------------------

api.get('/rates', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM board_rates ORDER BY id').all();
  return c.json(results);
});

api.patch(
  '/rates/:id',
  zValidator('json', z.object({ rate: z.number() })),
  async (c) => {
    const row = await c.env.DB.prepare(
      `UPDATE board_rates
       SET rate = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? RETURNING *`
    ).bind(c.req.valid('json').rate, c.req.param('id')).first();

    if (!row) return c.json({ error: 'Rate not found' }, 404);
    return c.json(row);
  }
);

// --- Transactions ------------------------------------------------------------

const TXN_FIELDS = [
  'currency_code', 'currency_name', 'rate', 'amount', 'total_thb', 'branch',
  'txn_type', 'customer_passport_no', 'customer_nationality', 'customer_name',
];

const txnBody = z.object({
  currency_code: nullableText,
  currency_name: nullableText,
  rate: nullableNum,
  amount: nullableNum,
  total_thb: nullableNum,
  branch: nullableText,
  txn_type: z.enum(['Buying', 'Selling']).nullish(),
  customer_passport_no: nullableText,
  customer_nationality: nullableText,
  customer_name: nullableText,
});

api.get('/transactions', async (c) => {
  const { from, to, branch } = c.req.query();

  // created_at is stored as ISO-8601 UTC, so string comparison is chronological.
  // That also lets callers pass a bare 'YYYY-MM-DD' as `from`.
  const where = [];
  const binds = [];
  if (from) { where.push('created_at >= ?'); binds.push(from); }
  if (to) { where.push('created_at <= ?'); binds.push(to); }
  if (branch) { where.push('branch = ?'); binds.push(branch); }

  const sql = `SELECT * FROM transactions${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC`;
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json(results);
});

// Daily sales roll-up, one row per (day, branch). The dashboard charts up to a
// year at a time; that is ~11k rows / ~3 MB of raw ledger for numbers the client
// would immediately add up and throw away, which is far too much to push to a
// phone. Aggregating here turns a year into ~700 rows (~40 KB).
//
// created_at is UTC ISO; the shop reads its days in Bangkok time, so the bucket
// is shifted by +7h before the date is taken.
const SHOP_TZ_SHIFT = '+7 hours';

api.get('/summary/daily', async (c) => {
  const { from, to, branch } = c.req.query();

  const where = ['branch IS NOT NULL'];
  const binds = [];
  if (from) { where.push('created_at >= ?'); binds.push(from); }
  if (to) { where.push('created_at <= ?'); binds.push(to); }
  if (branch) { where.push('branch = ?'); binds.push(branch); }

  const sql = `SELECT date(created_at, '${SHOP_TZ_SHIFT}') AS day,
                      branch,
                      SUM(COALESCE(total_thb, 0)) AS total,
                      COUNT(*) AS count
               FROM transactions
               WHERE ${where.join(' AND ')}
               GROUP BY day, branch
               ORDER BY day`;

  // Cached at the edge for a minute: every day but today is already final, and
  // the dashboard re-asks for the same ranges as the user flips between
  // 7 วัน / 1 เดือน / 1 ปี. Auth has already run, so nothing unauthenticated
  // can reach this.
  const cache = caches.default;
  const cacheKey = new Request(new URL(c.req.url).toString(), { method: 'GET' });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();

  const response = c.json(results);
  response.headers.set('Cache-Control', 'public, max-age=60');
  c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
});

// Rate history for one currency: the Super Rich reference rate each day next to
// the range of rates WE actually gave that day (min/max/avg from the ledger).
// One row per shop-day, Super Rich and our-rates merged on that day.
api.get('/rate-history', async (c) => {
  const { code, from, to } = c.req.query();
  if (!code) return c.json({ error: 'code is required' }, 400);

  // Super Rich reference rates (already stored per created_date = shop day).
  const srWhere = ['code = ?'];
  const srBinds = [code];
  if (from) { srWhere.push('created_date >= ?'); srBinds.push(from); }
  if (to) { srWhere.push('created_date <= ?'); srBinds.push(to); }
  const sr = await c.env.DB.prepare(
    `SELECT created_date AS day, buying AS sr_buying, selling AS sr_selling
     FROM superrich_rates WHERE ${srWhere.join(' AND ')} ORDER BY created_date`
  ).bind(...srBinds).all();

  // The rates we quoted, bucketed into Bangkok-local days like /summary/daily.
  const txWhere = ['currency_code = ?', 'rate IS NOT NULL'];
  const txBinds = [code];
  if (from) { txWhere.push(`date(created_at, '${SHOP_TZ_SHIFT}') >= ?`); txBinds.push(from); }
  if (to) { txWhere.push(`date(created_at, '${SHOP_TZ_SHIFT}') <= ?`); txBinds.push(to); }
  const tx = await c.env.DB.prepare(
    `SELECT date(created_at, '${SHOP_TZ_SHIFT}') AS day,
            MIN(rate) AS our_min, MAX(rate) AS our_max,
            AVG(rate) AS our_avg, COUNT(*) AS count
     FROM transactions WHERE ${txWhere.join(' AND ')} GROUP BY day`
  ).bind(...txBinds).all();

  const byDay = new Map();
  for (const r of sr.results) {
    byDay.set(r.day, {
      day: r.day, sr_buying: r.sr_buying, sr_selling: r.sr_selling,
      our_min: null, our_max: null, our_avg: null, count: 0,
    });
  }
  for (const r of tx.results) {
    const e = byDay.get(r.day) || {
      day: r.day, sr_buying: null, sr_selling: null,
      our_min: null, our_max: null, our_avg: null, count: 0,
    };
    e.our_min = r.our_min; e.our_max = r.our_max; e.our_avg = r.our_avg; e.count = r.count;
    byDay.set(r.day, e);
  }
  const merged = [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
  return c.json(merged);
});

// --- Super Rich reference rates ----------------------------------------------

const superrichLatest = (env) =>
  env.DB.prepare(
    `SELECT code, buying, selling, scraped_at
     FROM superrich_rates
     WHERE scraped_at = (SELECT MAX(scraped_at) FROM superrich_rates)
     ORDER BY code`
  ).all();

// Force a fresh scrape of today's Super Rich rates, then return the latest set.
// If the scrape fails (e.g. the upstream API hiccups) the last stored rates are
// still returned so the page keeps showing something.
api.post('/superrich/refresh', async (c) => {
  let scrape;
  try {
    scrape = await scrapeToday(c.env);
  } catch (e) {
    scrape = { success: false, error: e.message };
  }
  const { results } = await superrichLatest(c.env);
  return c.json({ scrape, latest: results });
});

// Read the latest stored Super Rich rates without forcing a scrape.
api.get('/superrich/latest', async (c) => {
  const { results } = await superrichLatest(c.env);
  return c.json(results);
});

// ---- Forecast core ----------------------------------------------------------
// suggested = Super Rich buying (that day) − our usual margin, where the margin is
// the gap between Super Rich buying and OUR LOWEST rate each day (outlier-filtered),
// recency-weighted toward the reference day.
const MARGIN_HALF_LIFE_DAYS = 4;   // recency weight halves every N days
const DAY_OUTLIER_BAND = 0.06;     // per day, ignore rates >6% from that day's median
const MARGIN_MAD_K = 3;            // drop days whose margin is >3·MAD from the median margin

const _median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
// The typical LOW rate that day, ignoring rates far from the day's median.
const _robustLow = (rates) => {
  const med = _median(rates);
  if (med === null) return null;
  const lo = med * (1 - DAY_OUTLIER_BAND), hi = med * (1 + DAY_OUTLIER_BAND);
  let kept = rates.filter(r => r >= lo && r <= hi);
  if (!kept.length) kept = rates;
  return Math.min(...kept);
};

const shopToday = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

// asOf: the shop day (YYYY-MM-DD) the forecast is "made on"; defaults to today.
async function computeForecast(env, { code, window = 30, asOf } = {}) {
  const w = Math.min(Math.max(parseInt(window, 10) || 30, 7), 365);
  const windowMod = `-${w} days`;
  const ref = asOf || shopToday();

  const latestWhere = code ? 'AND code = ?' : '';
  const latest = await env.DB.prepare(
    `SELECT code, buying AS sr_buying FROM superrich_rates WHERE created_date = ? ${latestWhere}`
  ).bind(...(code ? [ref, code] : [ref])).all();

  const codeFilter = code ? 'AND currency_code = ?' : '';
  const rateRows = await env.DB.prepare(
    `SELECT currency_code AS code, date(created_at, '${SHOP_TZ_SHIFT}') AS day, rate
     FROM transactions
     WHERE rate IS NOT NULL
       AND date(created_at, '${SHOP_TZ_SHIFT}') >= date(?, ?)
       AND date(created_at, '${SHOP_TZ_SHIFT}') <= ? ${codeFilter}`
  ).bind(...(code ? [ref, windowMod, ref, code] : [ref, windowMod, ref])).all();

  const srDayFilter = code ? 'AND code = ?' : '';
  const srRows = await env.DB.prepare(
    `SELECT code, created_date AS day, buying AS sr_buying FROM superrich_rates
     WHERE created_date >= date(?, ?) AND created_date <= ? ${srDayFilter}`
  ).bind(...(code ? [ref, windowMod, ref, code] : [ref, windowMod, ref])).all();

  const ratesByCodeDay = new Map();
  for (const r of rateRows.results) {
    if (!ratesByCodeDay.has(r.code)) ratesByCodeDay.set(r.code, new Map());
    const dm = ratesByCodeDay.get(r.code);
    if (!dm.has(r.day)) dm.set(r.day, []);
    dm.get(r.day).push(r.rate);
  }
  const srByCodeDay = new Map();
  for (const r of srRows.results) {
    if (!srByCodeDay.has(r.code)) srByCodeDay.set(r.code, new Map());
    srByCodeDay.get(r.code).set(r.day, r.sr_buying);
  }

  const ageDays = (day) => Math.max(0, Math.round((Date.parse(ref) - Date.parse(day)) / 86400000));

  const marginByCode = new Map();
  for (const [cd, dayMap] of ratesByCodeDay) {
    const srDays = srByCodeDay.get(cd);
    if (!srDays) continue;
    let daily = [];
    for (const [day, rates] of dayMap) {
      const sr = srDays.get(day);
      if (sr === undefined || sr === null) continue;
      const low = _robustLow(rates);
      if (low === null) continue;
      daily.push({ age: ageDays(day), margin: sr - low });
    }
    if (!daily.length) continue;
    if (daily.length >= 4) {
      const mMed = _median(daily.map(d => d.margin));
      const mad = _median(daily.map(d => Math.abs(d.margin - mMed))) || 0;
      if (mad > 0) daily = daily.filter(d => Math.abs(d.margin - mMed) <= MARGIN_MAD_K * mad);
    }
    let wsum = 0, msum = 0;
    for (const d of daily) {
      const wt = Math.pow(0.5, d.age / MARGIN_HALF_LIFE_DAYS);
      wsum += wt; msum += wt * d.margin;
    }
    marginByCode.set(cd, { avgMargin: wsum > 0 ? msum / wsum : null, samples: daily.length });
  }

  const trendWhere = code ? 'AND code = ?' : '';
  const trend = await env.DB.prepare(
    `SELECT code, AVG(buying) AS sr_avg7 FROM superrich_rates
     WHERE created_date >= date(?, '-7 days') AND created_date < ? ${trendWhere} GROUP BY code`
  ).bind(...(code ? [ref, ref, code] : [ref, ref])).all();
  const trendByCode = new Map(trend.results.map(r => [r.code, r.sr_avg7]));

  return latest.results.map(r => {
    const m = marginByCode.get(r.code);
    const avgMargin = m ? m.avgMargin : null;
    const samples = m ? m.samples : 0;
    const suggested = (r.sr_buying !== null && avgMargin !== null)
      ? Math.round((r.sr_buying - avgMargin) * 1e4) / 1e4 : null;
    const avg7 = trendByCode.get(r.code);
    let sr_trend = null;
    if (r.sr_buying !== null && avg7 !== null && avg7 !== undefined) {
      const diff = r.sr_buying - avg7;
      const eps = Math.abs(avg7) * 0.001;
      sr_trend = diff > eps ? 'up' : diff < -eps ? 'down' : 'flat';
    }
    return {
      code: r.code,
      sr_buying: r.sr_buying,
      avg_margin: avgMargin === null ? null : Math.round(avgMargin * 1e4) / 1e4,
      samples, suggested, sr_trend,
    };
  });
}

// Persist the forecast for one day (default today) into rate_forecast_log.
async function snapshotForecast(env, asOf) {
  const ref = asOf || shopToday();
  const rows = await computeForecast(env, { asOf: ref });
  if (!rows.length) return { forecast_date: ref, saved: 0 };
  await env.DB.batch(rows.map(r =>
    env.DB.prepare(
      `INSERT INTO rate_forecast_log (forecast_date, code, sr_buying, avg_margin, suggested, samples, sr_trend)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(forecast_date, code) DO UPDATE SET
         sr_buying = excluded.sr_buying, avg_margin = excluded.avg_margin,
         suggested = excluded.suggested, samples = excluded.samples, sr_trend = excluded.sr_trend`
    ).bind(ref, r.code, r.sr_buying, r.avg_margin, r.suggested, r.samples, r.sr_trend)
  ));
  return { forecast_date: ref, saved: rows.length };
}

api.get('/rate-forecast', async (c) => {
  const code = c.req.query('code');
  const out = await computeForecast(c.env, { code, window: c.req.query('window') });
  return c.json(code ? (out[0] ?? { code, sr_buying: null, avg_margin: null, samples: 0, suggested: null, sr_trend: null }) : out);
});

// How close past suggestions were to the rate we actually gave (robust low), per
// currency: mae = mean absolute error, bias = mean signed error (+ = suggested high).
api.get('/forecast-accuracy', async (c) => {
  const code = c.req.query('code');
  const window = Math.min(Math.max(parseInt(c.req.query('window') || '30', 10) || 30, 7), 365);
  const windowMod = `-${window} days`;
  const ref = shopToday();

  const fcWhere = code ? 'AND code = ?' : '';
  const fc = await c.env.DB.prepare(
    `SELECT forecast_date AS day, code, suggested FROM rate_forecast_log
     WHERE suggested IS NOT NULL AND forecast_date >= date(?, ?) AND forecast_date <= ? ${fcWhere}`
  ).bind(...(code ? [ref, windowMod, ref, code] : [ref, windowMod, ref])).all();

  const codeFilter = code ? 'AND currency_code = ?' : '';
  const rateRows = await c.env.DB.prepare(
    `SELECT currency_code AS code, date(created_at, '${SHOP_TZ_SHIFT}') AS day, rate
     FROM transactions WHERE rate IS NOT NULL
       AND date(created_at, '${SHOP_TZ_SHIFT}') >= date(?, ?)
       AND date(created_at, '${SHOP_TZ_SHIFT}') <= ? ${codeFilter}`
  ).bind(...(code ? [ref, windowMod, ref, code] : [ref, windowMod, ref])).all();

  const actualByCodeDay = new Map();
  for (const r of rateRows.results) {
    if (!actualByCodeDay.has(r.code)) actualByCodeDay.set(r.code, new Map());
    const dm = actualByCodeDay.get(r.code);
    if (!dm.has(r.day)) dm.set(r.day, []);
    dm.get(r.day).push(r.rate);
  }

  const byCode = new Map();
  for (const row of fc.results) {
    const dm = actualByCodeDay.get(row.code);
    const rates = dm && dm.get(row.day);
    if (!rates || !rates.length) continue;
    const actual = _robustLow(rates);
    if (actual === null) continue;
    const err = row.suggested - actual;
    const e = byCode.get(row.code) || { code: row.code, n: 0, absSum: 0, errSum: 0 };
    e.n += 1; e.absSum += Math.abs(err); e.errSum += err;
    byCode.set(row.code, e);
  }

  const out = [...byCode.values()].map(e => ({
    code: e.code, n: e.n,
    mae: Math.round((e.absSum / e.n) * 1e4) / 1e4,
    bias: Math.round((e.errSum / e.n) * 1e4) / 1e4,
  })).sort((a, b) => (a.code < b.code ? -1 : 1));

  return c.json(code ? (out[0] ?? { code, n: 0, mae: null, bias: null }) : out);
});

// Sales forecast: predict daily THB sales for the next `horizon` days.
// Model = deseasonalized LEVEL (recency-weighted, so it tracks the recent trend)
// × WEEKDAY factor (exchange shops have a strong day-of-week pattern). Returns
// history + forecast (with a ±1σ band) + the weekday profile.
const DOW_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const dowOf = (ymd) => new Date(ymd + 'T00:00:00Z').getUTCDay();

api.get('/sales-forecast', async (c) => {
  const branch = c.req.query('branch');
  const horizon = Math.min(Math.max(parseInt(c.req.query('horizon') || '14', 10) || 14, 1), 60);
  const lookback = 90;
  const ref = shopToday();

  const where = ['branch IS NOT NULL',
    `date(created_at, '${SHOP_TZ_SHIFT}') >= date(?, '-${lookback} days')`,
    `date(created_at, '${SHOP_TZ_SHIFT}') <= ?`];
  const binds = [ref, ref];
  if (branch) { where.push('branch = ?'); binds.push(branch); }

  const { results } = await c.env.DB.prepare(
    `SELECT date(created_at, '${SHOP_TZ_SHIFT}') AS day,
            SUM(COALESCE(total_thb, 0)) AS total, COUNT(*) AS count
     FROM transactions WHERE ${where.join(' AND ')} GROUP BY day ORDER BY day`
  ).bind(...binds).all();

  const history = results.map(r => ({ day: r.day, total: r.total, count: r.count }));
  if (!history.length) {
    return c.json({ branch: branch || 'all', level: 0, history: [], forecast: [], weekday: [], summary: { next7_total: 0, avg_per_day: 0 } });
  }

  const overallMean = history.reduce((a, h) => a + h.total, 0) / history.length;

  // Weekday factor = that weekday's mean ÷ overall mean.
  const byDow = Array.from({ length: 7 }, () => []);
  history.forEach(h => byDow[dowOf(h.day)].push(h.total));
  const factor = byDow.map(arr => (arr.length && overallMean > 0)
    ? (arr.reduce((a, b) => a + b, 0) / arr.length) / overallMean : 1);

  // Recency-weighted deseasonalized level (half-life 21 days).
  const refT = Date.parse(ref);
  let wsum = 0, lsum = 0;
  for (const h of history) {
    const f = factor[dowOf(h.day)] || 1;
    if (f <= 0) continue;
    const age = Math.max(0, Math.round((refT - Date.parse(h.day)) / 86400000));
    const w = Math.pow(0.5, age / 21);
    wsum += w; lsum += w * (h.total / f);
  }
  const level = wsum > 0 ? lsum / wsum : overallMean;

  // ±1σ band from the fit residuals.
  let sq = 0;
  for (const h of history) { const exp = level * (factor[dowOf(h.day)] || 1); sq += (h.total - exp) ** 2; }
  const std = history.length > 1 ? Math.sqrt(sq / history.length) : 0;

  const forecast = [];
  for (let i = 1; i <= horizon; i++) {
    const d = new Date(refT + i * 86400000).toISOString().slice(0, 10);
    const pred = Math.max(0, level * (factor[dowOf(d)] || 1));
    forecast.push({
      day: d, dow: dowOf(d),
      predicted: Math.round(pred),
      low: Math.round(Math.max(0, pred - std)),
      high: Math.round(pred + std),
    });
  }

  const next7 = forecast.slice(0, 7).reduce((a, b) => a + b.predicted, 0);
  const weekday = factor.map((f, i) => ({
    dow: i, name: DOW_TH[i],
    factor: Math.round(f * 100) / 100,
    avg: Math.round(level * f),
  }));

  return c.json({
    branch: branch || 'all',
    level: Math.round(level),
    history, forecast, weekday,
    summary: { next7_total: Math.round(next7), avg_per_day: Math.round(next7 / 7) },
  });
});

// Backtest the sales forecast over the last `days` (≤31). For each past day the
// model is refit using ONLY data before that day (no leakage), then compared to
// the actual — so this answers "does the forecast meet expectations?".
api.get('/sales-forecast/backtest', async (c) => {
  const branch = c.req.query('branch');
  const days = Math.min(Math.max(parseInt(c.req.query('days') || '90', 10) || 90, 7), 120);
  const lookback = 90;
  const ref = shopToday();
  const dayMs = 86400000;
  const addDays = (ymd, n) => new Date(Date.parse(ymd) + n * dayMs).toISOString().slice(0, 10);

  const where = ['branch IS NOT NULL',
    `date(created_at, '${SHOP_TZ_SHIFT}') >= date(?, '-${days + lookback + 1} days')`,
    `date(created_at, '${SHOP_TZ_SHIFT}') <= ?`];
  const binds = [ref, ref];
  if (branch) { where.push('branch = ?'); binds.push(branch); }
  const { results } = await c.env.DB.prepare(
    `SELECT date(created_at, '${SHOP_TZ_SHIFT}') AS day, SUM(COALESCE(total_thb, 0)) AS total
     FROM transactions WHERE ${where.join(' AND ')} GROUP BY day ORDER BY day`
  ).bind(...binds).all();

  const totalByDay = new Map(results.map(r => [r.day, r.total]));
  const allDays = results.map(r => ({ day: r.day, total: r.total }));

  // Refit the level × weekday model using only days strictly before `cutoff`.
  const fit = (cutoff) => {
    const start = addDays(cutoff, -lookback);
    const rows = allDays.filter(d => d.day < cutoff && d.day >= start);
    if (rows.length < 14) return null;
    const mean = rows.reduce((a, b) => a + b.total, 0) / rows.length;
    const byDow = Array.from({ length: 7 }, () => []);
    rows.forEach(h => byDow[dowOf(h.day)].push(h.total));
    const factor = byDow.map(arr => (arr.length && mean > 0) ? (arr.reduce((a, b) => a + b, 0) / arr.length) / mean : 1);
    const cutT = Date.parse(cutoff);
    let ws = 0, ls = 0;
    for (const h of rows) { const f = factor[dowOf(h.day)] || 1; if (f <= 0) continue; const age = Math.max(0, Math.round((cutT - Date.parse(h.day)) / dayMs)); const w = Math.pow(0.5, age / 21); ws += w; ls += w * (h.total / f); }
    const level = ws > 0 ? ls / ws : mean;
    let sq = 0; for (const h of rows) { const e = level * (factor[dowOf(h.day)] || 1); sq += (h.total - e) ** 2; }
    const std = rows.length > 1 ? Math.sqrt(sq / rows.length) : 0;
    return { level, factor, std };
  };

  const points = [];
  let absPctSum = 0, absSum = 0, errSum = 0, hit = 0, n = 0;
  for (let i = days; i >= 1; i--) {          // oldest → newest, skip today (incomplete)
    const d = addDays(ref, -i);
    if (!totalByDay.has(d)) continue;
    const actual = totalByDay.get(d);
    if (actual <= 0) continue;
    const m = fit(d);
    if (!m) continue;
    const predicted = Math.max(0, m.level * (m.factor[dowOf(d)] || 1));
    const within = actual >= predicted - m.std && actual <= predicted + m.std;
    const err = predicted - actual;
    points.push({
      day: d, predicted: Math.round(predicted), actual: Math.round(actual),
      low: Math.round(Math.max(0, predicted - m.std)), high: Math.round(predicted + m.std), within,
    });
    absPctSum += Math.abs(err) / actual; absSum += Math.abs(err); errSum += err; if (within) hit++; n++;
  }

  return c.json({
    branch: branch || 'all', n,
    mape: n ? Math.round((absPctSum / n) * 1000) / 10 : null,   // mean abs % error
    mae: n ? Math.round(absSum / n) : null,                     // mean abs error (THB)
    bias: n ? Math.round(errSum / n) : null,                    // + = over-predicted
    hit_rate: n ? Math.round((hit / n) * 1000) / 10 : null,     // % of days within ±1σ
    points,
  });
});

api.post('/transactions', zValidator('json', txnBody), async (c) => {
  const body = c.req.valid('json');
  const row = await c.env.DB.prepare(
    `INSERT INTO transactions (${TXN_FIELDS.join(', ')})
     VALUES (${TXN_FIELDS.map(() => '?').join(', ')}) RETURNING *`
  ).bind(...TXN_FIELDS.map((f) => body[f] ?? null)).first();

  return c.json(row, 201);
});

api.patch('/transactions/:id', zValidator('json', txnBody.partial()), async (c) => {
  const patch = buildPatch(c.req.valid('json'), TXN_FIELDS);
  if (patch.isEmpty) return c.json({ error: 'No updatable fields provided' }, 400);

  const row = await c.env.DB.prepare(
    `UPDATE transactions SET ${patch.clause} WHERE id = ? RETURNING *`
  ).bind(...patch.values, c.req.param('id')).first();

  if (!row) return c.json({ error: 'Transaction not found' }, 404);
  return c.json(row);
});

api.delete('/transactions/:id', async (c) => {
  const { meta } = await c.env.DB.prepare('DELETE FROM transactions WHERE id = ?')
    .bind(c.req.param('id')).run();

  if (!meta.changes) return c.json({ error: 'Transaction not found' }, 404);
  return c.body(null, 204);
});

// --- Cash balance log --------------------------------------------------------

api.get('/balance-logs', async (c) => {
  const { date, branch } = c.req.query();

  const where = [];
  const binds = [];
  if (date) { where.push('log_date = ?'); binds.push(date); }
  if (branch) { where.push('branch = ?'); binds.push(branch); }

  // Oldest first, so the timeline reads top-to-bottom by time.
  const sql = `SELECT * FROM cash_balance_log${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at ASC`;
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json(results);
});

api.post(
  '/balance-logs',
  zValidator('json', z.object({
    log_date: z.string(),
    branch: z.string(),
    kind: z.enum(['opening', 'closing']),
    amount: z.number(),
    system_snapshot: nullableNum,
    note: nullableText,
  })),
  async (c) => {
    const b = c.req.valid('json');
    const row = await c.env.DB.prepare(
      `INSERT INTO cash_balance_log (log_date, branch, kind, amount, system_snapshot, note)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
    ).bind(b.log_date, b.branch, b.kind, b.amount, b.system_snapshot ?? null, b.note ?? null).first();

    return c.json(row, 201);
  }
);

api.patch(
  '/balance-logs/:id',
  zValidator('json', z.object({ amount: z.number().optional(), note: nullableText })),
  async (c) => {
    const patch = buildPatch(c.req.valid('json'), ['amount', 'note']);
    if (patch.isEmpty) return c.json({ error: 'No updatable fields provided' }, 400);

    const row = await c.env.DB.prepare(
      `UPDATE cash_balance_log SET ${patch.clause} WHERE id = ? RETURNING *`
    ).bind(...patch.values, c.req.param('id')).first();

    if (!row) return c.json({ error: 'Balance log entry not found' }, 404);
    return c.json(row);
  }
);

api.delete('/balance-logs/:id', async (c) => {
  const { meta } = await c.env.DB.prepare('DELETE FROM cash_balance_log WHERE id = ?')
    .bind(c.req.param('id')).run();

  if (!meta.changes) return c.json({ error: 'Balance log entry not found' }, 404);
  return c.body(null, 204);
});

app.route('/api', api);

// --- Scraper routes ----------------------------------------------------------
// Kept on their original paths so existing bookmarks and manual triggers work.

app.get('/trigger', async (c) => c.json(await scrapeToday(c.env)));

app.get('/backfill', async (c) => {
  const { from, to, code } = c.req.query();
  if (!from || !to) return c.json({ error: 'from=YYYY-MM-DD&to=YYYY-MM-DD required' }, 400);
  return c.json(await backfill(c.env, from, to, code));
});

app.get('/latest', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT code, currency, country_name, denomination, buying, selling, scraped_at
     FROM superrich_rates
     WHERE scraped_at = (SELECT MAX(scraped_at) FROM superrich_rates)
     ORDER BY code`
  ).all();
  return c.json({ count: results.length, data: results });
});

app.get('/rates', async (c) => {
  const code = c.req.query('code');
  const limit = parseInt(c.req.query('limit') || '100');
  const stmt = code
    ? c.env.DB.prepare('SELECT * FROM superrich_rates WHERE code = ? ORDER BY created_date DESC LIMIT ?').bind(code.toUpperCase(), limit)
    : c.env.DB.prepare('SELECT * FROM superrich_rates ORDER BY scraped_at DESC LIMIT ?').bind(limit);
  const { results } = await stmt.all();
  return c.json({ count: results.length, data: results });
});

app.get('/stats', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT COUNT(*) as total_rows, MIN(created_date) as earliest_date,
            MAX(created_date) as latest_date,
            COUNT(DISTINCT created_date) as total_days,
            COUNT(DISTINCT code) as total_codes
     FROM superrich_rates`
  ).first();
  return c.json(row);
});

// Snapshot the forecast into rate_forecast_log. No range → today; from/to →
// backfill each day's forecast as-of that day (used to seed accuracy history).
app.get('/snapshot-forecast', async (c) => {
  const { from, to } = c.req.query();
  if (!from || !to) return c.json(await snapshotForecast(c.env));
  let days = 0;
  for (let d = new Date(from); d <= new Date(to); d.setDate(d.getDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    const r = await snapshotForecast(c.env, day);
    if (r.saved) days++;
  }
  return c.json({ success: true, days });
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

export default {
  fetch: app.fetch,

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      await scrapeToday(env);
      await snapshotForecast(env); // record today's suggestion for accuracy tracking
    })());
  },
};
