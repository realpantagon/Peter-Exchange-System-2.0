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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/trigger') {
      try { return Response.json(await scrapeToday(env)); }
      catch (e) { return Response.json({ success: false, error: e.message }, { status: 500 }); }
    }

    if (url.pathname === '/backfill') {
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      if (!from || !to) return Response.json({ error: 'from=YYYY-MM-DD&to=YYYY-MM-DD required' }, { status: 400 });
      try { return Response.json(await backfill(env, from, to)); }
      catch (e) { return Response.json({ success: false, error: e.message }, { status: 500 }); }
    }

    if (url.pathname === '/latest') {
      const { results } = await env.DB.prepare(
        `SELECT code, currency, country_name, denomination, buying, selling, scraped_at
         FROM superrich_rates
         WHERE scraped_at = (SELECT MAX(scraped_at) FROM superrich_rates)
         ORDER BY code`
      ).all();
      return Response.json({ count: results.length, data: results });
    }

    if (url.pathname === '/rates') {
      const code = url.searchParams.get('code');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const stmt = code
        ? env.DB.prepare('SELECT * FROM superrich_rates WHERE code = ? ORDER BY created_date DESC LIMIT ?').bind(code.toUpperCase(), limit)
        : env.DB.prepare('SELECT * FROM superrich_rates ORDER BY scraped_at DESC LIMIT ?').bind(limit);
      const { results } = await stmt.all();
      return Response.json({ count: results.length, data: results });
    }

    if (url.pathname === '/stats') {
      const { results } = await env.DB.prepare(
        `SELECT COUNT(*) as total_rows, MIN(created_date) as earliest_date,
                MAX(created_date) as latest_date,
                COUNT(DISTINCT created_date) as total_days,
                COUNT(DISTINCT code) as total_codes
         FROM superrich_rates`
      ).all();
      return Response.json(results[0]);
    }

    return new Response(
      `Peter Exchange — Super Rich Rate Scraper

Endpoints:
  GET /trigger                          Manual scrape today
  GET /backfill?from=2026-01-01&to=...  Backfill historical dates
  GET /latest                           Latest rates
  GET /rates?code=USD&limit=30          Rate history by code
  GET /stats                            DB summary

Codes: USD USD2 USD1 EUR JPY GBP SGD AUD CHF HKD CAD NZD TWD MYR CNY KRW`,
      { headers: { 'Content-Type': 'text/plain' } }
    );
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(scrapeToday(env));
  },
};
