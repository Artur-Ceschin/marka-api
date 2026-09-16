import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { updateDetectionSchema } from "@/applications/schemas/identify";

describe("updateDetectionSchema", () => {
  it("rejects a body that changes nothing", () => {
    assert.equal(updateDetectionSchema.safeParse({}).success, false);
  });

  it("treats a blank note as removing it", () => {
    assert.equal(updateDetectionSchema.parse({ notes: "   " }).notes, null);
  });

  it("stores observedAt in UTC whatever offset it arrives with", () => {
    const { observedAt } = updateDetectionSchema.parse({
      observedAt: "2026-09-14T09:30:00-03:00",
    });

    assert.equal(observedAt, "2026-09-14T12:30:00.000Z");
  });

  it("refuses an observation in the future", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    assert.equal(
      updateDetectionSchema.safeParse({ observedAt: tomorrow }).success,
      false,
    );
  });

  it("accepts null to clear the location", () => {
    assert.equal(
      updateDetectionSchema.parse({ location: null }).location,
      null,
    );
  });
});
