import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConfirmDetectionUseCase } from "@/applications/useCases/identify/ConfirmDetectionUseCase";
import { AppError } from "@/kernel/errors/AppError";
import type { Detection, PlantEnrichment } from "@/shared/types/plant";

const USER = "b428a418-2001-70dc-2a7c-ab479eb808fc";
const DETECTION_ID = "2026-09-10T12:00:00.000Z#abcd1234";

const ENRICHMENT: PlantEnrichment = {
  description: "A rose.",
  care: "Full sun.",
  toxicity: "Not toxic to cats or dogs.",
  nativeStatus: "Native to the Middle East.",
};

function detection(overrides: Partial<Detection> = {}): Detection {
  return {
    userId: USER,
    detectionId: DETECTION_ID,
    imageUrl: `s3://marka-plants/uploads/${USER}/abc`,
    candidates: [
      {
        species: "Rosa gallica",
        scientificName: "Rosa gallica L.",
        commonNames: ["French rose"],
        family: "Rosaceae",
        genus: "Rosa",
        confidence: 0.9,
      },
    ],
    status: "pending_confirmation",
    createdAt: "2026-09-10T12:00:00.000Z",
    ...overrides,
  };
}

function makeDeps(stored: Detection | null = detection()) {
  const enrichCalls: string[] = [];
  const confirmCalls: unknown[] = [];

  return {
    enrichCalls,
    confirmCalls,
    detections: {
      findById: async () => stored ?? undefined,
      confirm: async (input: { species: string }) => {
        confirmCalls.push(input);
        return detection({
          status: "confirmed",
          confirmedSpecies: input.species,
        });
      },
    },
    bucket: { getObject: async () => Buffer.from("jpeg") },
    enrichment: {
      enrich: async ({ species }: { species: string }) => {
        enrichCalls.push(species);
        return ENRICHMENT;
      },
    },
  };
}

describe("ConfirmDetectionUseCase", () => {
  it("enriches the confirmed species and stores the result", async () => {
    const deps = makeDeps();

    const result = await new ConfirmDetectionUseCase(
      deps.detections,
      deps.bucket,
      deps.enrichment,
    ).execute({
      userId: USER,
      detectionId: DETECTION_ID,
      species: "Rosa gallica",
    });

    assert.deepEqual(deps.enrichCalls, ["Rosa gallica"]);
    assert.equal(result.status, "confirmed");
    assert.deepEqual(result.enrichment, ENRICHMENT);
  });

  it("refuses a species PlantNet never proposed", async () => {
    const deps = makeDeps();

    await assert.rejects(
      () =>
        new ConfirmDetectionUseCase(
          deps.detections,
          deps.bucket,
          deps.enrichment,
        ).execute({
          userId: USER,
          detectionId: DETECTION_ID,
          species: "Cannabis sativa",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, "SPECIES_NOT_A_CANDIDATE");
        return true;
      },
    );

    // Without this guard the endpoint is a free "write care instructions for
    // anything" call, and the stored detection would claim an identification
    // that never happened.
    assert.deepEqual(deps.enrichCalls, []);
    assert.deepEqual(deps.confirmCalls, []);
  });

  it("does not enrich a detection belonging to someone else", async () => {
    const deps = makeDeps(null);

    await assert.rejects(
      () =>
        new ConfirmDetectionUseCase(
          deps.detections,
          deps.bucket,
          deps.enrichment,
        ).execute({
          userId: USER,
          detectionId: DETECTION_ID,
          species: "Rosa gallica",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );

    assert.deepEqual(deps.enrichCalls, []);
  });
});
