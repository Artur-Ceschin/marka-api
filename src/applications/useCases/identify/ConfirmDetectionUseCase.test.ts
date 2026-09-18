import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConfirmDetectionUseCase } from "@/applications/useCases/identify/ConfirmDetectionUseCase";
import { IdentificationTokens } from "@/applications/useCases/identify/IdentificationTokens";
import { PlantBucket } from "@/infra/clients/s3";
import { AppError } from "@/kernel/errors/AppError";
import type { Detection, PlantEnrichment } from "@/shared/types/plant";

const USER = "b428a418-2001-70dc-2a7c-ab479eb808fc";
const DETECTION_ID = "2026-09-10T12:00:00.000Z#abcd1234";
const UPLOAD_KEY = `uploads/${USER}/abc`;

const ENRICHMENT: PlantEnrichment = {
  description: "A rose.",
  care: "Full sun.",
  toxicity: "Not toxic to cats or dogs.",
  nativeStatus: "Native to the Middle East.",
};

const tokens = new IdentificationTokens("test-secret");

const TOKEN = tokens.issue({
  userId: USER,
  detectionId: DETECTION_ID,
  key: UPLOAD_KEY,
  candidates: [
    {
      species: "Rosa gallica",
      scientificName: "Rosa gallica L.",
      commonNames: ["French rose"],
      family: "Rosaceae",
      genus: "Rosa",
      confidence: 0.9,
      images: [],
    },
  ],
  certainty: "high",
  identifiedAt: "2026-09-10T12:00:00.000Z",
});

function makeDeps({
  createWins = true,
  enrichError,
  thumbnailFails = false,
}: {
  createWins?: boolean;
  enrichError?: Error;
  thumbnailFails?: boolean;
} = {}) {
  const enrichCalls: string[] = [];
  const enrichLocales: string[] = [];
  const created: Detection[] = [];
  const persisted: string[] = [];
  const objects = new Set([UPLOAD_KEY]);
  const rows = new Map<string, Detection>();

  const useCase = new ConfirmDetectionUseCase(
    {
      findById: async (_userId: string, detectionId: string) =>
        rows.get(detectionId),
      create: async (detection: Detection) => {
        created.push(detection);
        if (!createWins) return false;
        rows.set(detection.detectionId, detection);
        return true;
      },
    },
    {
      getObject: async (key: string) => {
        if (!objects.has(key)) {
          throw new AppError(404, "UPLOAD_NOT_FOUND", "Upload not found");
        }
        return Buffer.from("jpeg");
      },
      persist: async (key: string) => {
        persisted.push(key);
        const durable = PlantBucket.durableKeyFor(key);
        objects.add(durable);
        return durable;
      },
      saveThumbnail: async (imageKey: string) => {
        if (thumbnailFails) throw new Error("Corrupt JPEG");
        const key = `${imageKey}-thumb`;
        objects.add(key);
        return key;
      },
      deleteObject: async (key: string) => {
        objects.delete(key);
      },
      imageUrl: async (key: string) => `https://signed.test/${key}`,
    },
    {
      enrich: async ({
        species,
        locale,
      }: {
        species: string;
        locale: string;
      }) => {
        enrichCalls.push(species);
        enrichLocales.push(locale);
        if (enrichError) throw enrichError;
        return ENRICHMENT;
      },
    },
    tokens,
  );

  return {
    useCase,
    enrichCalls,
    enrichLocales,
    created,
    persisted,
    objects,
    rows,
  };
}

const confirm = (deps: ReturnType<typeof makeDeps>, species = "Rosa gallica") =>
  deps.useCase.execute({
    userId: USER,
    identificationToken: TOKEN,
    species,
    locale: "en",
  });

describe("ConfirmDetectionUseCase", () => {
  it("creates the detection, with its image copied out of uploads/", async () => {
    const deps = makeDeps();

    const result = await confirm(deps);

    assert.equal(result.confirmedSpecies, "Rosa gallica");
    assert.deepEqual(result.enrichment, ENRICHMENT);
    assert.equal(result.detectionId, DETECTION_ID);
    assert.equal(deps.created[0]?.imageKey, `detections/${USER}/abc`);
    assert.equal(result.imageUrl, `https://signed.test/detections/${USER}/abc`);
    assert.equal(
      result.thumbnailUrl,
      `https://signed.test/detections/${USER}/abc-thumb`,
    );
  });

  it("still saves when no thumbnail can be made", async () => {
    const deps = makeDeps({ thumbnailFails: true });
    const originalError = console.error;
    console.error = () => {};

    try {
      const result = await confirm(deps);

      assert.equal(result.confirmedSpecies, "Rosa gallica");
      assert.equal(result.thumbnailUrl, undefined);
    } finally {
      console.error = originalError;
    }
  });

  it("writes care text in the caller's language and records which", async () => {
    const deps = makeDeps();

    const result = await deps.useCase.execute({
      userId: USER,
      identificationToken: TOKEN,
      species: "Rosa gallica",
      locale: "pt-BR",
    });

    assert.deepEqual(deps.enrichLocales, ["pt-BR"]);
    // Stored, so a later language switch can tell this text is Portuguese.
    assert.equal(deps.created[0]?.locale, "pt-BR");
    assert.equal(result.locale, "pt-BR");
  });

  it("refuses a species PlantNet never proposed, before paying for anything", async () => {
    const deps = makeDeps();

    await assert.rejects(
      () => confirm(deps, "Cannabis sativa"),
      (error: unknown) =>
        error instanceof AppError && error.code === "SPECIES_NOT_A_CANDIDATE",
    );
    assert.deepEqual(deps.enrichCalls, []);
    assert.deepEqual(deps.created, []);
  });

  it("rejects a replayed token without a second LLM call", async () => {
    const deps = makeDeps();
    await confirm(deps);

    await assert.rejects(
      () => confirm(deps),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );
    assert.equal(deps.enrichCalls.length, 1);
  });

  it("cannot be replayed after the detection is deleted", async () => {
    // Without deleting the upload, save → delete → save again with the same
    // token is an unlimited loop of paid enrichment calls.
    const deps = makeDeps();
    await confirm(deps);
    deps.rows.clear();

    await assert.rejects(
      () => confirm(deps),
      (error: unknown) =>
        error instanceof AppError && error.code === "UPLOAD_NOT_FOUND",
    );
    assert.equal(deps.enrichCalls.length, 1);
  });

  it("is a 409 when a concurrent request created the detection first", async () => {
    const deps = makeDeps({ createWins: false });

    await assert.rejects(
      () => confirm(deps),
      (error: unknown) => error instanceof AppError && error.statusCode === 409,
    );
  });

  it("keeps the upload when the write fails, so the token can retry", async () => {
    const deps = makeDeps({ createWins: false });

    await assert.rejects(() => confirm(deps));

    assert.ok(deps.objects.has(UPLOAD_KEY));
  });

  it("saves the choice without care text when the model refuses", async () => {
    const deps = makeDeps({
      enrichError: new AppError(422, "ENRICHMENT_REFUSED", "Refused"),
    });

    const result = await confirm(deps);

    assert.equal(result.confirmedSpecies, "Rosa gallica");
    assert.equal(result.enrichment, undefined);
    assert.equal(deps.created.length, 1);
  });

  it("stores and copies nothing when enrichment fails, so the token can retry", async () => {
    const deps = makeDeps({ enrichError: new Error("OpenAI down") });

    await assert.rejects(() => confirm(deps));
    assert.deepEqual(deps.created, []);
    assert.deepEqual(deps.persisted, []);
    assert.ok(deps.objects.has(UPLOAD_KEY));
  });
});
