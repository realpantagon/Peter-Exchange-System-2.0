import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

// =============================================================================
// Super Rich rate scraper — unchanged behaviour, now mounted on a Hono app.
// =============================================================================

const SUPERRICH_CURRENT = 'https://www.superrichthailand.com/web/api/v1/rates';
const SUPERRICH_HISTORY = 'https://www.superrichthailand.com/api/v1/rates/history';
const SUPERRICH_AUTH = 'Basic c3VwZXJyaWNoVGg6aFRoY2lycmVwdXM=';

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
  SGD: [{ code: 'SGD', denoms: null }],
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

function extractRows(exchangeRate, createdDate, scrapedAt) {
  const rows = [];
  for (const cur of exchangeRate) {
    const rules = CURRENCY_MAP[cur.cUnit];
    if (!rules) continue; // skip currencies not in list

    for (const rule of rules) {
      let rate;
      if (rule.denoms === null) {
        // Take the first (highest) denomination
        rate = cur.rate[0];
      } else {
        rate = cur.rate.find((r) => rule.denoms.includes(r.denom?.trim()));
      }
      if (!rate) continue;
      rows.push({
        scrapedAt,
        code: rule.code,
        currency: cur.cUnit,
        countryName: cur.countryName,
        denom: rate.denom,
        buying: rate.cBuying,
        selling: rate.cSelling,
        createdDate,
      });
    }
  }
  return rows;
}

async function insertRows(env, rows) {
  if (!rows.length) return;
  const stmts = rows.map((r) =>
    env.DB.prepare(
      `INSERT OR IGNORE INTO superrich_rates
       (scraped_at, code, currency, country_name, denomination, buying, selling, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(r.scrapedAt, r.code, r.currency, r.countryName, r.denom, r.buying, r.selling, r.createdDate)
  );
  await env.DB.batch(stmts);
}

async function scrapeToday(env) {
  const r = await fetch(SUPERRICH_CURRENT, {
    headers: { Authorization: SUPERRICH_AUTH, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`Current API ${r.status}`);
  const json = await r.json();
  if (json.code !== 20000) throw new Error(json.descriptionEn);

  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const rows = extractRows(json.data.exchangeRate, today, now);
  await insertRows(env, rows);
  return { success: true, scraped_at: now, codes_saved: rows.map((r) => r.code) };
}

async function backfill(env, fromStr, toStr) {
  let saved = 0, skipped = 0;
  const errors = [];

  for (let d = new Date(fromStr); d <= new Date(toStr); d.setDate(d.getDate() + 1)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const createdDate = `${yyyy}-${mm}-${dd}`;
    const apiDate = `${mm}-${dd}-${yyyy}`;

    const exists = await env.DB.prepare(
      'SELECT 1 FROM superrich_rates WHERE created_date = ? LIMIT 1'
    ).bind(createdDate).first();
    if (exists) { skipped++; continue; }

    try {
      const r = await fetch(SUPERRICH_HISTORY, {
        method: 'POST',
        headers: { Authorization: SUPERRICH_AUTH, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `date=${apiDate}`,
      });
      const json = await r.json();
      if (json.code === 20000 && json.data?.exchangeRate?.length) {
        const scrapedAt = json.data.exchangeRate[0]?.rate?.[0]?.dateTime || new Date().toISOString();
        const rows = extractRows(json.data.exchangeRate, createdDate, scrapedAt);
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

// Suggested rate to set today, per currency:
//   suggested = Super Rich buying today − our usual margin
// where the margin is the average gap between Super Rich buying and the rate we
// actually gave (transactions), over the last `window` days. Also returns a
// short-term Super Rich trend (today vs the last 7 days) as a hint.
api.get('/rate-forecast', async (c) => {
  const code = c.req.query('code');
  const window = Math.min(Math.max(parseInt(c.req.query('window') || '30', 10) || 30, 7), 365);
  const windowMod = `-${window} days`;

  // Latest Super Rich buying per code (from the most recent scrape).
  const latestWhere = code ? 'AND code = ?' : '';
  const latest = await c.env.DB.prepare(
    `SELECT code, buying AS sr_buying FROM superrich_rates
     WHERE scraped_at = (SELECT MAX(scraped_at) FROM superrich_rates) ${latestWhere}`
  ).bind(...(code ? [code] : [])).all();

  // Average margin (Super Rich buying − our avg rate) per code over the window.
  const marginWhere = code ? 'WHERE sr.code = ?' : '';
  const margin = await c.env.DB.prepare(
    `WITH sr AS (
        SELECT code, created_date AS day, buying AS sr_buying
        FROM superrich_rates
        WHERE created_date >= date('now', '+7 hours', ?)
     ),
     ours AS (
        SELECT currency_code AS code, date(created_at, '${SHOP_TZ_SHIFT}') AS day, AVG(rate) AS our_avg
        FROM transactions
        WHERE rate IS NOT NULL AND date(created_at, '${SHOP_TZ_SHIFT}') >= date('now', '+7 hours', ?)
        GROUP BY code, day
     )
     SELECT sr.code,
            AVG(sr.sr_buying - ours.our_avg) AS avg_margin,
            COUNT(*) AS samples
     FROM sr JOIN ours ON sr.code = ours.code AND sr.day = ours.day
     ${marginWhere}
     GROUP BY sr.code`
  ).bind(...(code ? [windowMod, windowMod, code] : [windowMod, windowMod])).all();

  // Super Rich 7-day average per code, for a simple up/down/flat trend hint.
  const trendWhere = code ? 'AND code = ?' : '';
  const trend = await c.env.DB.prepare(
    `SELECT code, AVG(buying) AS sr_avg7 FROM superrich_rates
     WHERE created_date >= date('now', '+7 hours', '-7 days') ${trendWhere} GROUP BY code`
  ).bind(...(code ? [code] : [])).all();

  const marginByCode = new Map(margin.results.map(r => [r.code, r]));
  const trendByCode = new Map(trend.results.map(r => [r.code, r.sr_avg7]));

  const out = latest.results.map(r => {
    const m = marginByCode.get(r.code);
    const avgMargin = m ? m.avg_margin : null;
    const samples = m ? m.samples : 0;
    const suggested = (r.sr_buying !== null && avgMargin !== null)
      ? Math.round((r.sr_buying - avgMargin) * 1e4) / 1e4
      : null;
    const avg7 = trendByCode.get(r.code);
    let sr_trend = null;
    if (r.sr_buying !== null && avg7 !== null && avg7 !== undefined) {
      const diff = r.sr_buying - avg7;
      const eps = Math.abs(avg7) * 0.001; // 0.1% dead-band
      sr_trend = diff > eps ? 'up' : diff < -eps ? 'down' : 'flat';
    }
    return {
      code: r.code,
      sr_buying: r.sr_buying,
      avg_margin: avgMargin === null ? null : Math.round(avgMargin * 1e4) / 1e4,
      samples,
      suggested,
      sr_trend,
    };
  });

  return c.json(code ? (out[0] ?? { code, sr_buying: null, avg_margin: null, samples: 0, suggested: null, sr_trend: null }) : out);
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
  const { from, to } = c.req.query();
  if (!from || !to) return c.json({ error: 'from=YYYY-MM-DD&to=YYYY-MM-DD required' }, 400);
  return c.json(await backfill(c.env, from, to));
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

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

export default {
  fetch: app.fetch,

  async scheduled(event, env, ctx) {
    ctx.waitUntil(scrapeToday(env));
  },
};
