// Local backfill — no subrequest limits
// Run: node backfill-local.mjs
// Then: npx wrangler d1 execute peter-exchange --remote --file=/tmp/superrich_backfill.sql

import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

// See worker/src/index.js for context on the Aug 2026 Super Rich site relaunch.
const SUPERRICH_LIST = 'https://api.superrichthailand.com/api/v1/exchange-client/list';
const SUPERRICH_BRANCH_ID = 10;

const CURRENCY_MAP = {
  USD: [
    { code: 'USD',  denoms: ['100', '50'] },
    { code: 'USD2', denoms: ['20 - 10', '20-10', '10', '20'] },
    { code: 'USD1', denoms: ['1'] },
  ],
  EUR: [{ code: 'EUR', denoms: null }],
  JPY: [{ code: 'JPY', denoms: null }],
  GBP: [{ code: 'GBP', denoms: null }],
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
    if (!rules) continue;
    for (const rule of rules) {
      const rate = rule.denoms === null
        ? denoms[0]
        : denoms.find((r) => rule.denoms.includes(r.denomRem?.trim()));
      if (!rate) continue;
      rows.push({
        scrapedAt: scrapedAt.replace(/'/g, "''"),
        code: rule.code,
        currency: unit,
        countryName: null,
        denom: (rate.denomRem || '').replace(/'/g, "''"),
        buying: Number(rate.buyText),
        selling: Number(rate.sellText),
        createdDate,
      });
    }
  }
  return rows;
}

function generateDates(from, to) {
  const dates = [];
  for (let d = new Date(from); d <= new Date(to); d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

async function fetchDate(dateStr) {
  const r = await fetch(`${SUPERRICH_LIST}?branchId=${SUPERRICH_BRANCH_ID}&type=exchange-history&date=${dateStr}`, {
    headers: { Accept: 'application/json' },
  });
  const json = await r.json();
  if (json.statusCode !== 200 || !json.data?.exchange || !Object.keys(json.data.exchange).length) return null;
  return json.data.exchange;
}

async function main() {
  const from = process.argv[2] || '2026-01-01';
  const to   = process.argv[3] || '2026-08-25';
  const dates = generateDates(from, to);
  console.log(`Fetching ${dates.length} dates (${from} → ${to})...`);

  const allRows = [];
  let done = 0, failed = 0;

  for (const date of dates) {
    try {
      const exchange = await fetchDate(date);
      if (exchange) {
        const scrapedAt = `${date}T12:00:00.000Z`;
        allRows.push(...extractRows(exchange, date, scrapedAt));
        done++;
      } else {
        failed++;
      }
    } catch (e) {
      console.error(`\n${date}: ${e.message}`);
      failed++;
    }
    process.stdout.write(`\r  ${done} saved, ${failed} failed, ${dates.length - done - failed} remaining...`);
  }

  console.log(`\nDone. ${allRows.length} rows from ${done} days.`);

  if (!allRows.length) { console.log('Nothing to insert.'); return; }

  // Split into batches of 200 rows and execute each
  const BATCH = 200;
  let batchNum = 0;
  for (let i = 0; i < allRows.length; i += BATCH) {
    const batch = allRows.slice(i, i + BATCH);
    const vals = batch.map(
      (r) => `('${r.scrapedAt}','${r.code}','${r.currency}',NULL,'${r.denom}',${r.buying},${r.selling},'${r.createdDate}')`
    ).join(',\n');
    const sql = `INSERT OR IGNORE INTO superrich_rates (scraped_at,code,currency,country_name,denomination,buying,selling,created_date) VALUES\n${vals};`;

    const sqlFile = `/tmp/superrich_batch_${batchNum}.sql`;
    writeFileSync(sqlFile, sql);
    batchNum++;

    process.stdout.write(`  Inserting batch ${batchNum} (rows ${i + 1}-${Math.min(i + BATCH, allRows.length)})...`);
    execSync(`npx wrangler d1 execute peter-exchange --remote --file=${sqlFile}`, {
      stdio: 'pipe',
      cwd: process.cwd(),
    });
    console.log(' done');
  }
  console.log(`\nAll ${batchNum} batches inserted successfully!`);
}

main().catch(console.error);
