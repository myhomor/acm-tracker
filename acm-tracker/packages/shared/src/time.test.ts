import { describe, expect, it } from "vitest";
import { localDayBounds, localHourMinute } from "./time";

describe("localHourMinute", () => {
  it("formats local hours and minutes with leading zeros", () => {
    expect(localHourMinute(new Date(2026, 9, 24, 9, 5))).toBe("09:05");
  });
});

describe("localDayBounds", () => {
  it("returns local midnight to next local midnight", () => {
    const bounds = localDayBounds("2026-10-24");
    expect(bounds?.from).toEqual(new Date(2026, 9, 24));
    expect(bounds?.to).toEqual(new Date(2026, 9, 25));
  });

  it("rejects malformed or impossible dates", () => {
    expect(localDayBounds("24.10.2026")).toBeNull();
    expect(localDayBounds("2026-02-30")).toBeNull();
  });
});
