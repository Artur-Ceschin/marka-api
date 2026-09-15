import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.USAGE_TABLE = "marka-api-usage-test";

const { UsageRepository } = await import(
  "@/infra/repositories/usageRepository"
);

describe("UsageRepository.today", () => {
  it("buckets by UTC date, not local time", () => {
    // 23:30 in São Paulo (UTC-3) is already the next day in UTC. Bucketing
    // locally would give every user a different reset moment, and the quota
    // exists to protect one shared daily allowance.
    const lateInBrazil = new Date("2026-09-11T02:30:00Z");

    assert.equal(UsageRepository.today(lateInBrazil), "2026-09-11");
  });

  it("rolls over at midnight UTC", () => {
    const before = UsageRepository.today(new Date("2026-09-10T23:59:59Z"));
    const after = UsageRepository.today(new Date("2026-09-11T00:00:01Z"));

    assert.equal(before, "2026-09-10");
    assert.equal(after, "2026-09-11");
    assert.notEqual(before, after);
  });

  it("produces a key that sorts chronologically", () => {
    const earlier = UsageRepository.today(new Date("2026-09-09T12:00:00Z"));
    const later = UsageRepository.today(new Date("2026-09-11T12:00:00Z"));

    assert.ok(earlier < later);
  });
});

describe("UsageRepository.secondsUntilReset", () => {
  it("counts down to the next midnight UTC", () => {
    const oneMinuteBefore = new Date("2026-09-14T23:59:00Z");

    assert.equal(UsageRepository.secondsUntilReset(oneMinuteBefore), 60);
  });

  it("returns a full day exactly at midnight", () => {
    const midnight = new Date("2026-09-14T00:00:00Z");

    assert.equal(UsageRepository.secondsUntilReset(midnight), 86_400);
  });
});
