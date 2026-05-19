/**
 * Verifies multi-hop swap route aggregate math (compound price impact, mean fee bps).
 * Run from repo root: pnpm verify:swap-route-aggregates
 */
'use strict';

const {
  averageFeeBpsAcrossHops,
  compoundRoutePriceImpactPercent,
} = require('../packages/shared/dist/index.cjs');

function approxEq(a, b, eps = 1e-6) {
  return Math.abs(a - b) < eps;
}

let failed = false;

function assert(cond, msg) {
  if (!cond) {
    failed = true;
    console.error('FAIL:', msg);
  }
}

// Multihop compound: (1 - 0.02)(1 - 0.03) = 0.9506 → impact 4.94%
const r1 = compoundRoutePriceImpactPercent([2, 3]);
assert(
  r1 !== null && approxEq(r1, 4.94),
  `compound [2,3] expected ~4.94, got ${r1}`,
);

const r2 = compoundRoutePriceImpactPercent([0.5]);
assert(
  r2 !== null && approxEq(r2, 0.5),
  `single hop 0.5% expected 0.5, got ${r2}`,
);

assert(compoundRoutePriceImpactPercent([]) === null, 'empty hops → null');
assert(
  compoundRoutePriceImpactPercent([1, null]) === null,
  'null hop impact → null',
);

const avg = averageFeeBpsAcrossHops([{ feeBps: 30 }, { feeBps: 10 }]);
assert(avg !== null && approxEq(avg, 20), `avg bps expected 20, got ${avg}`);

assert(averageFeeBpsAcrossHops([]) === null, 'avg empty → null');

if (failed) {
  process.exit(1);
}
console.log('OK: swap-route aggregate helpers (compound impact, average fee bps).');
