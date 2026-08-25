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
