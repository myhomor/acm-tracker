import type { AiUsage, CostBreakdown, ModelPrice, TimeEntry } from "./types";

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function computeEntryCost(entry: TimeEntry): number {
  return round2((entry.minutes / 60) * entry.ratePerHourSnapshot);
}

export interface CostSummary {
  total: number;
  billable: number;
  minutes: number;
}

export function sumCost(entries: TimeEntry[]): CostSummary {
  const acc = entries.reduce(
    (a, e) => {
      const cost = computeEntryCost(e);
      a.total += cost;
      if (e.billable) a.billable += cost;
      a.minutes += e.minutes;
      return a;
    },
    { total: 0, billable: 0, minutes: 0 },
  );
  return { total: round2(acc.total), billable: round2(acc.billable), minutes: acc.minutes };
}

export function aiCostFromUsage(usage: AiUsage, prices: ModelPrice[]): number {
  const price = prices.find((p) => p.model === usage.model);
  if (!price) return 0;
  const cost = (usage.tokensIn / 1_000_000) * price.inputPer1M
    + (usage.tokensOut / 1_000_000) * price.outputPer1M;
  return Math.round(cost * 100) / 100;
}

export function breakdownCost(human: number, ai: number): CostBreakdown {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { human: r2(human), ai: r2(ai), total: r2(human + ai) };
}
