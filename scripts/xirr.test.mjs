import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateGroupedXirr, calculateXirr } from '../artifacts/portfolio/src/lib/xirr.ts';

test('calculates a one-year lump-sum return', () => {
  const result = calculateXirr([
    { date: '2025-01-01', amount: -1000 },
    { date: '2026-01-01', amount: 1100 },
  ]);
  assert.ok(result !== null);
  assert.ok(Math.abs(result - 0.1) < 0.0001);
});

test('calculates staggered deposits', () => {
  const result = calculateXirr([
    { date: '2025-01-01', amount: -1000 },
    { date: '2025-07-01', amount: -1000 },
    { date: '2026-01-01', amount: 2200 },
  ]);
  assert.ok(result !== null);
  assert.ok(result > 0 && result < 0.3);
});

test('handles a same-day deposit', () => {
  const result = calculateXirr([
    { date: '2026-01-01', amount: -1000 },
    { date: '2026-01-01', amount: 1200 },
  ]);
  assert.ok(result !== null);
  assert.ok(Math.abs(result - 0.2) < 0.000001);
});

test('calculates real return using the Fisher equation', () => {
  const nominal = 0.10;
  const real = (1 + nominal) / (1 + 0.08) - 1;
  assert.ok(Math.abs(real - 0.0185185185) < 0.0000001);
});

test('groups funds and excludes linked internal transfers from combined return', () => {
  const transactions = [
    { date: '2025-01-01', amount: 1000, txType: 'buy', holdingType: 'stock' },
    { date: '2025-06-01', amount: 1100, txType: 'sell', holdingType: 'stock', internalTransferId: 'T1' },
    { date: '2025-06-01', amount: 1100, txType: 'buy', holdingType: 'fund', internalTransferId: 'T1' },
  ];
  const stocks = calculateGroupedXirr(transactions, { stock: 1200, fund: 1200 }, 'stock', new Date('2026-01-01'));
  const funds = calculateGroupedXirr(transactions, { stock: 1200, fund: 1200 }, 'fund', new Date('2026-01-01'));
  const combined = calculateGroupedXirr(transactions, { stock: 1200, fund: 1200 }, 'combined', new Date('2026-01-01'));
  assert.equal(stocks.cashFlowCount, 3);
  assert.equal(funds.cashFlowCount, 2);
  assert.equal(combined.cashFlowCount, 2);
});

test('supports a funds-only portfolio while leaving stocks empty', () => {
  const result = calculateGroupedXirr([
    { date: '2025-01-01', amount: 1000, txType: 'buy', holdingType: 'fund' },
  ], { stock: 0, fund: 1200 }, 'fund', new Date('2026-01-01'));
  const stocks = calculateGroupedXirr([], { stock: 0, fund: 1200 }, 'stock', new Date('2026-01-01'));
  assert.ok(result.xirr !== null);
  assert.equal(stocks.xirr, null);
});

test('keeps stock-only and fund-only calculations separate', () => {
  const combinedTransactions = [
    { date: '2025-01-01', amount: 1000, txType: 'buy', holdingType: 'stock' },
    { date: '2025-04-01', amount: 500, txType: 'buy', holdingType: 'fund' },
    { date: '2026-01-01', amount: 1600, txType: 'sell', holdingType: 'stock' },
    { date: '2026-01-01', amount: 650, txType: 'sell', holdingType: 'fund' },
  ];
  const stocks = calculateGroupedXirr(combinedTransactions, { stock: 1600, fund: 700 }, 'stock', new Date('2026-01-01'));
  const funds = calculateGroupedXirr(combinedTransactions, { stock: 1600, fund: 700 }, 'fund', new Date('2026-01-01'));
  const combined = calculateGroupedXirr(combinedTransactions, { stock: 1600, fund: 700 }, 'combined', new Date('2026-01-01'));
  assert.ok(stocks.xirr !== null);
  assert.ok(funds.xirr !== null);
  assert.ok(combined.xirr !== null);
  assert.notEqual(stocks.xirr, funds.xirr);
});
