export type HoldingType = 'stock' | 'fund';

export interface XirrTransaction {
  date: string;
  amount: number;
  txType: 'buy' | 'sell';
  holdingType: HoldingType;
  internalTransferId?: string | null;
}

export interface XirrGroupResult {
  xirr: number | null;
  profit: number | null;
  cashFlowCount: number;
  netDeposits: number | null;
}

function xnpv(rate: number, cashFlows: Array<{ date: Date; amount: number }>, start: Date): number {
  return cashFlows.reduce((sum, cashFlow) => {
    const years = (cashFlow.date.getTime() - start.getTime()) / (365 * 24 * 60 * 60 * 1000);
    return sum + cashFlow.amount / Math.pow(1 + rate, years);
  }, 0);
}

function normalizeCashFlow(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function calculateXirr(cashFlows: Array<{ date: string; amount: number }>): number | null {
  const parsed = cashFlows
    .map((cashFlow) => ({
      date: new Date(cashFlow.date),
      amount: normalizeCashFlow(Number(cashFlow.amount)),
    }))
    .filter((cashFlow) => Number.isFinite(cashFlow.amount) && Number.isFinite(cashFlow.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (parsed.length < 2) return null;
  if (!parsed.some((cashFlow) => cashFlow.amount < 0) || !parsed.some((cashFlow) => cashFlow.amount > 0)) {
    return null;
  }

  if (parsed.every((cashFlow) => cashFlow.date.getTime() === parsed[0].date.getTime())) {
    const invested = -parsed.filter((cashFlow) => cashFlow.amount < 0).reduce((sum, cashFlow) => sum + cashFlow.amount, 0);
    const returned = parsed.filter((cashFlow) => cashFlow.amount > 0).reduce((sum, cashFlow) => sum + cashFlow.amount, 0);
    return invested > 0 ? returned / invested - 1 : null;
  }

  const start = parsed[0].date;
  const npv = (rate: number) => xnpv(rate, parsed, start);
  let lower = -0.9999;
  let upper = 10;
  let lowerValue = npv(lower);
  let upperValue = npv(upper);

  for (let attempt = 0; attempt < 12 && lowerValue * upperValue > 0; attempt += 1) {
    upper *= 2;
    upperValue = npv(upper);
  }
  if (!Number.isFinite(lowerValue) || !Number.isFinite(upperValue) || lowerValue * upperValue > 0) return null;

  for (let iteration = 0; iteration < 120; iteration += 1) {
    const middle = (lower + upper) / 2;
    const middleValue = npv(middle);
    if (!Number.isFinite(middleValue)) return null;
    if (Math.abs(middleValue) < 0.000001) return middle;
    if (lowerValue * middleValue <= 0) {
      upper = middle;
      upperValue = middleValue;
    } else {
      lower = middle;
      lowerValue = middleValue;
    }
  }

  return (lower + upper) / 2;
}

export function realReturnFromNominal(nominalRate: number | null, inflationRate: number): number | null {
  if (nominalRate === null || !Number.isFinite(nominalRate)) return null;
  if (!Number.isFinite(inflationRate)) return null;
  return (1 + nominalRate) / (1 + inflationRate) - 1;
}

export function calculateGroupedXirr(
  transactions: XirrTransaction[],
  currentValues: Record<HoldingType, number>,
  holdingType: HoldingType | 'combined',
  asOf = new Date(),
): XirrGroupResult {
  const relevant = transactions.filter((transaction) => {
    if (holdingType !== 'combined' && transaction.holdingType !== holdingType) return false;
    if (holdingType === 'combined') {
      return !transaction.internalTransferId;
    }
    return true;
  });

  const cashFlows = relevant.map((transaction) => ({
    date: transaction.date,
    amount: transaction.txType === 'buy' ? -Math.abs(transaction.amount) : Math.abs(transaction.amount),
  }));

  const currentValue = holdingType === 'combined'
    ? currentValues.stock + currentValues.fund
    : currentValues[holdingType];

  if (!Number.isFinite(currentValue) || currentValue <= 0) {
    return { xirr: null, profit: null, cashFlowCount: cashFlows.length, netDeposits: null };
  }

  const cashFlowsWithFinalValue = [...cashFlows, { date: asOf.toISOString(), amount: currentValue }];
  const netDeposits = -cashFlowsWithFinalValue
    .slice(0, -1)
    .reduce((sum, cashFlow) => sum + cashFlow.amount, 0);

  return {
    xirr: calculateXirr(cashFlowsWithFinalValue),
    profit: currentValue - netDeposits,
    cashFlowCount: cashFlowsWithFinalValue.length,
    netDeposits,
  };
}
