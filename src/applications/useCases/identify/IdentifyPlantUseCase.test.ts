import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IdentifyPlantUseCase } from "@/applications/useCases/identify/IdentifyPlantUseCase";
import { DetectionsRepository } from "@/infra/repositories/detectionsRepository";
import type { Detection, Plant } from "@/shared/types/plant";

const USER = "b428a418-2001-70dc-2a7c-ab479eb808fc";
const PLANTS: Plant[] = [
  {
    species: "Rosa gallica",
    confidence: 0.9,
    endemic: false,
    plantType: "shrubs",
  },
];

function makeDeps() {
  const saved: Detection[] = [];

  return {
    saved,
    bucket: { upload: async () => "https://s3/plants/x.jpg" },
    identifier: { identify: async () => PLANTS },
    detections: {
      save: async (d: Detection) => {
        saved.push(d);
      },
    },
  };
}

describe("IdentifyPlantUseCase", () => {
  it("stores the detection against the calling user", async () => {
    const deps = makeDeps();

    await new IdentifyPlantUseCase(
      deps.bucket,
      deps.identifier,
      deps.detections,
      () => "2026-09-10T12:00:00.000Z#abcd1234",
    ).execute({ userId: USER, imageData: Buffer.from("jpeg") });

    // Without userId on the row there is no way to read a user's own
    // detections without scanning the whole table.
    assert.equal(deps.saved.length, 1);
    assert.equal(deps.saved[0]?.userId, USER);
    assert.deepEqual(deps.saved[0]?.plants, PLANTS);
  });

  it("returns the detectionId it stored, so the client can reference it", async () => {
    const deps = makeDeps();
    const id = "2026-09-10T12:00:00.000Z#abcd1234";

    const result = await new IdentifyPlantUseCase(
      deps.bucket,
      deps.identifier,
      deps.detections,
      () => id,
    ).execute({ userId: USER, imageData: Buffer.from("jpeg") });

    assert.equal(result.detectionId, id);
    assert.equal(deps.saved[0]?.detectionId, id);
  });
});

describe("DetectionsRepository.newId", () => {
  it("sorts chronologically as plain text", () => {
    const earlier = DetectionsRepository.newId(
      new Date("2026-09-10T09:00:00Z"),
    );
    const later = DetectionsRepository.newId(new Date("2026-09-10T17:00:00Z"));

    // DynamoDB sorts sort keys lexicographically. An ISO-8601 prefix makes
    // that chronological, which is what lets the newest-first Query work
    // without sorting in code.
    assert.ok(earlier < later, `${earlier} should sort before ${later}`);
  });

  it("does not collide within the same millisecond", () => {
    const at = new Date("2026-09-10T09:00:00Z");
    const ids = new Set(
      Array.from({ length: 50 }, () => DetectionsRepository.newId(at)),
    );

    assert.equal(ids.size, 50);
  });
});
