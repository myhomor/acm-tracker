import { describe, it, expect } from "vitest";
import { computeEntryCost, sumCost, aiCostFromUsage, breakdownCost } from "./cost";
import type { TimeEntry, AiUsage, ModelPrice } from "./types";

const entry = (minutes: number, rate: number, billable = true): TimeEntry => ({
  id: "e", taskId: "t", memberId: "m", origin: "manual",
  minutes, billable, ratePerHourSnapshot: rate, note: null,
  startedAt: "2026-06-05T09:00:00Z", createdAt: "2026-06-05T09:00:00Z",
});

describe("computeEntryCost", () => {
  it("multiplies minutes by hourly rate", () => {
    expect(computeEntryCost(entry(60, 45))).toBe(45);
    expect(computeEntryCost(entry(30, 48.5))).toBe(24.25);
  });
  it("rounds to 2 decimals", () => {
    expect(computeEntryCost(entry(45, 32))).toBe(24);
    expect(computeEntryCost(entry(7, 45))).toBe(5.25);
  });
});

describe("sumCost", () => {
  it("sums billable and non-billable separately", () => {
    const r = sumCost([entry(60, 45), entry(30, 45, false)]);
    expect(r.total).toBe(67.5);
    expect(r.billable).toBe(45);
  });
  it("returns zeros for empty input", () => {
    expect(sumCost([])).toEqual({ total: 0, billable: 0, minutes: 0 });
  });
});

const price = (model: string, inP: number, outP: number): ModelPrice => ({
  id: model, provider: "anthropic", model, inputPer1M: inP, outputPer1M: outP, createdAt: "now",
});

describe("aiCostFromUsage", () => {
  const prices = [price("opus", 15, 75), price("haiku", 1, 5)];
  it("prices tokens per 1M for the matching model", () => {
    const usage: AiUsage = { model: "opus", tokensIn: 1_000_000, tokensOut: 1_000_000 };
    expect(aiCostFromUsage(usage, prices)).toBe(90);
  });
  it("scales sub-million token counts and rounds to 2 decimals", () => {
    const usage: AiUsage = { model: "opus", tokensIn: 1240, tokensOut: 980 };
    expect(aiCostFromUsage(usage, prices)).toBe(0.09);
  });
  it("returns 0 when the model has no price", () => {
    const usage: AiUsage = { model: "unknown", tokensIn: 1000, tokensOut: 1000 };
    expect(aiCostFromUsage(usage, prices)).toBe(0);
  });
});

describe("breakdownCost", () => {
  it("combines human and ai into a total", () => {
    expect(breakdownCost(1508, 332)).toEqual({ human: 1508, ai: 332, total: 1840 });
  });
  it("rounds the total to 2 decimals", () => {
    expect(breakdownCost(22.5, 0.09)).toEqual({ human: 22.5, ai: 0.09, total: 22.59 });
  });
});
