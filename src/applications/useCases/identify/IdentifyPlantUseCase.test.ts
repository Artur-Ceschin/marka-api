import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IdentifyPlantUseCase } from "@/applications/useCases/identify/IdentifyPlantUseCase";
import { PlantBucket } from "@/infra/clients/s3";
import { DetectionsRepository } from "@/infra/repositories/detectionsRepository";
import type { Detection, PlantCandidate } from "@/shared/types/plant";

const USER = "b428a418-2001-70dc-2a7c-ab479eb808fc";
const PLANTS: PlantCandidate[] = [
  {
    species: "Rosa gallica",
    scientificName: "Rosa gallica L.",
    commonNames: ["French rose"],
    family: "Rosaceae",
    genus: "Rosa",
    confidence: 0.9,
  },
];

function makeDeps({ identifyFails = false } = {}) {
  const saved: Detection[] = [];
  const persisted: string[] = [];

  return {
    saved,
    persisted,
    bucket: {
      getObject: async () => Buffer.from("jpeg"),
      persist: async (key: string) => {
        persisted.push(key);
        return PlantBucket.durableKeyFor(key);
      },
    },
    identifier: {
      identify: async () => {
        if (identifyFails) throw new Error("PlantNet unavailable");
        return PLANTS;
      },
    },
    detections: {
      save: async (d: Detection) => {
        saved.push(d);
      },
    },
    usage: {
      claimIdentification: async () => ({ used: 1, limit: 5, remaining: 4 }),
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
      deps.usage,
      () => "2026-09-10T12:00:00.000Z#abcd1234",
    ).execute({ userId: USER, key: `uploads/${USER}/abc` });

    assert.equal(deps.saved.length, 1);
    assert.equal(deps.saved[0]?.userId, USER);
    assert.deepEqual(deps.saved[0]?.candidates, PLANTS);
  });

  it("returns the detectionId it stored, so the client can reference it", async () => {
    const deps = makeDeps();
    const id = "2026-09-10T12:00:00.000Z#abcd1234";

    const result = await new IdentifyPlantUseCase(
      deps.bucket,
      deps.identifier,
      deps.detections,
      deps.usage,
      () => id,
    ).execute({ userId: USER, key: `uploads/${USER}/abc` });

    assert.equal(result.detectionId, id);
    assert.equal(deps.saved[0]?.detectionId, id);
  });

  it("stores the image outside the expiring uploads/ prefix", async () => {
    const deps = makeDeps();

    await new IdentifyPlantUseCase(
      deps.bucket,
      deps.identifier,
      deps.detections,
      deps.usage,
      () => "id",
    ).execute({ userId: USER, key: `uploads/${USER}/abc` });

    // uploads/ is deleted by lifecycle after 7 days; a detection pointing
    // there would lose its image and could no longer be confirmed.
    assert.equal(deps.saved[0]?.imageKey, `detections/${USER}/abc`);
  });

  it("keeps no durable copy when identification fails", async () => {
    const deps = makeDeps({ identifyFails: true });

    await assert.rejects(() =>
      new IdentifyPlantUseCase(
        deps.bucket,
        deps.identifier,
        deps.detections,
        deps.usage,
        () => "id",
      ).execute({ userId: USER, key: `uploads/${USER}/abc` }),
    );

    assert.deepEqual(deps.persisted, []);
    assert.deepEqual(deps.saved, []);
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
