import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DetectionsRepository } from "@/infra/repositories/detectionsRepository";
import type { DetectionChanges } from "@/shared/types/plant";

const NOW = "2026-09-14T12:00:00.000Z";

describe("DetectionsRepository.updateExpressionFor", () => {
  it("sets new values and removes nulls in one expression", () => {
    const result = DetectionsRepository.updateExpressionFor(
      { notes: "By the garden gate", location: null },
      NOW,
    );

    assert.equal(
      result.UpdateExpression,
      "SET #updatedAt = :updatedAt, #notes = :notes REMOVE #location",
    );
    assert.deepEqual(result.ExpressionAttributeValues, {
      ":updatedAt": NOW,
      ":notes": "By the garden gate",
    });
  });

  it("leaves fields the client did not send untouched", () => {
    const result = DetectionsRepository.updateExpressionFor(
      { observedAt: "2026-09-01T08:00:00.000Z" },
      NOW,
    );

    assert.deepEqual(Object.values(result.ExpressionAttributeNames).sort(), [
      "observedAt",
      "updatedAt",
    ]);
  });

  it("never writes an attribute outside the editable list", () => {
    // The schema strips unknown keys, but the repository must not depend on it:
    // a stray `status` here would un-confirm a detection.
    const result = DetectionsRepository.updateExpressionFor(
      { notes: "x", status: "pending_confirmation" } as DetectionChanges,
      NOW,
    );

    assert.ok(!result.UpdateExpression.includes("status"));
  });
});
