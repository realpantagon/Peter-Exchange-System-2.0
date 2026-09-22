import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeRateHistory } from '../src/rate-history.js';

test('CNY discounted notes do not set chart extrema or average', () => {
  const rates = [4.8, 4.82, 4.81, 3, 3.5];
  const original = [...rates];
  const [day] = summarizeRateHistory(rates.map(rate => ({ day: '2026-09-03', rate })));
  assert.equal(day.our_min, 4.8);
  assert.equal(day.our_max, 4.82);
  assert.ok(Math.abs(day.our_avg - 4.81) < 1e-10);
  assert.equal(day.filtered_count, 2);
  assert.equal(day.count, 5);
  assert.deepEqual(rates, original);
});

test('stable neighboring days identify a sparse discounted day at any currency scale', () => {
  for (const scale of [1, 0.001, 10]) {
    const rows = [1, 2, 3, 4, 5].map(d => ({ day: `2026-09-0${d}`, rate: (d === 3 ? 3 : 4.8) * scale }));
    const result = summarizeRateHistory(rows);
    assert.equal(result[2].our_min, null);
    assert.equal(result[2].filtered_count, 1);
    assert.equal(result[0].filtered_count, 0);
  }
});

test('sparse split keeps the normal note quote instead of an artificial midpoint', () => {
  const [day] = summarizeRateHistory([6, 7.283].map(rate => ({ day: '2026-08-30', rate })));
  assert.equal(day.our_min, 7.283);
  assert.equal(day.kept_count, 1);
});

test('isolated normal rates, moderate real movement and empty input are preserved', () => {
  assert.deepEqual(summarizeRateHistory([]), []);
  const rows = [24.7, 24.8, 25, 25.3, 25.4].map((rate, i) => ({ day: `2026-09-0${i + 1}`, rate }));
  for (const day of summarizeRateHistory(rows)) assert.equal(day.filtered_count, 0);
  assert.equal(summarizeRateHistory([rows[0]])[0].our_min, 24.7);
});
