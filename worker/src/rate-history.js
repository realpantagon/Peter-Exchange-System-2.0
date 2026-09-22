// Display-only filtering. Never alters ledger entries or forecast calculations.
const BAND = 0.06;
const DAY_MS = 86400000;
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const near = (rate, center) => Math.abs(rate - center) <= center * BAND;
const upperQuartile = values => [...values].sort((a, b) => a - b)[Math.round((values.length - 1) * 0.75)];

export function summarizeRateHistory(rows) {
  const days = new Map();
  for (const row of rows) {
    if (!days.has(row.day)) days.set(row.day, []);
    days.get(row.day).push(row.rate);
  }
  const centers = [...days].map(([day, rates]) => {
    const valid = rates.filter(r => Number.isFinite(r) && r > 0);
    let center = valid.length ? median(valid) : null;
    // A two-rate split has a midpoint that represents neither transaction.
    // With no local cluster, prefer the upper (non-discounted) observation.
    if (center !== null && !valid.some(r => near(r, center))) center = upperQuartile(valid);
    return { day, time: Date.parse(day), center,
      reference: valid.length ? upperQuartile(valid) : null };
  });
  return centers.map(({ day, time, center }) => {
    const rates = days.get(day);
    // A stable group of nearby DAYS resolves sparse days containing only small
    // notes, or a 50/50 split. Each day gets one vote, not each transaction.
    const neighbors = centers.filter(d => d.day !== day && d.reference !== null && Math.abs(d.time - time) <= 7 * DAY_MS)
      .map(d => d.reference);
    if (neighbors.length >= 3) {
      // Small-note discounts bias the lower cluster. Require at least three
      // supporting days around the upper quartile, then use their median.
      const typical = neighbors.filter(r => near(r, upperQuartile(neighbors)));
      if (typical.length >= Math.max(3, Math.ceil(neighbors.length / 2))) {
        center = median(typical);
      }
    }
    const kept = center === null ? [] : rates.filter(r => Number.isFinite(r) && r > 0 && near(r, center));
    return {
      day, our_min: kept.length ? Math.min(...kept) : null,
      our_max: kept.length ? Math.max(...kept) : null,
      our_avg: kept.length ? kept.reduce((sum, r) => sum + r, 0) / kept.length : null,
      count: rates.length, filtered_count: rates.length - kept.length, kept_count: kept.length,
    };
  });
}
