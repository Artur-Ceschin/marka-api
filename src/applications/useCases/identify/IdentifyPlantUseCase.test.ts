import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IdentificationTokens } from "@/applications/useCases/identify/IdentificationTokens";
import {
  certaintyOf,
  IdentifyPlantUseCase,
} from "@/applications/useCases/identify/IdentifyPlantUseCase";
import { DetectionsRepository } from "@/infra/repositories/detectionsRepository";
import type { Locale } from "@/shared/locale";
import type { PlantCandidate } from "@/shared/types/plant";

const USER = "b428a418-2001-70dc-2a7c-ab479eb808fc";
const DETECTION_ID = "2026-09-10T12:00:00.000Z#abcd1234";
const PLANTS: PlantCandidate[] = [
  {
    species: "Rosa gallica",
    scientificName: "Rosa gallica L.",
    commonNames: ["French rose"],
    family: "Rosaceae",
    genus: "Rosa",
    confidence: 0.9,
    images: [{ url: "https://bs.plantnet.org/image/m/abc", author: "A. B." }],
  },
];

const tokens = new IdentificationTokens("test-secret");

function makeUseCase({ identifyFails = false } = {}) {
  const locales: Locale[] = [];

  const useCase = new IdentifyPlantUseCase(
    { getObject: async () => Buffer.from("jpeg") },
    {
      identify: async (_image: Buffer, locale: Locale) => {
        locales.push(locale);
        if (identifyFails) throw new Error("PlantNet unavailable");
        return PLANTS;
      },
    },
    { claimIdentification: async () => ({ used: 1, limit: 5, remaining: 4 }) },
    tokens,
    () => DETECTION_ID,
  );

  return { useCase, locales };
}

const request = {
  userId: USER,
  key: `uploads/${USER}/abc`,
  locale: "en" as const,
};

describe("IdentifyPlantUseCase", () => {
  it("returns the candidates with their reference images", async () => {
    const result = await makeUseCase().useCase.execute(request);

    assert.deepEqual(result.candidates, PLANTS);
  });

  it("asks PlantNet for common names in the caller's language", async () => {
    const { useCase, locales } = makeUseCase();

    await useCase.execute({ ...request, locale: "pt-BR" });

    assert.deepEqual(locales, ["pt-BR"]);
  });

  it("signs the result for the caller, so confirming needs no stored row", async () => {
    const result = await makeUseCase().useCase.execute({
      ...request,
      observedAt: "2026-09-01T08:00:00.000Z",
    });

    const claims = tokens.read(result.identificationToken, USER);

    assert.equal(claims.detectionId, DETECTION_ID);
    assert.equal(claims.key, `uploads/${USER}/abc`);
    assert.equal(claims.observedAt, "2026-09-01T08:00:00.000Z");
  });

  it("refuses another user's upload before spending anything", async () => {
    const { useCase, locales } = makeUseCase();

    await assert.rejects(() =>
      useCase.execute({ ...request, key: "uploads/someone-else/abc" }),
    );
    assert.deepEqual(locales, []);
  });

  it("issues no token when identification fails", async () => {
    await assert.rejects(() =>
      makeUseCase({ identifyFails: true }).useCase.execute(request),
    );
  });
});

describe("certaintyOf", () => {
  const candidate = (confidence: number): PlantCandidate => ({
    species: "Rosa gallica",
    scientificName: "Rosa gallica L.",
    commonNames: [],
    family: "Rosaceae",
    genus: "Rosa",
    confidence,
    images: [],
  });

  it("is high for a strong score well ahead of the runner-up", () => {
    assert.equal(certaintyOf([candidate(0.8), candidate(0.3)]), "high");
  });

  it("is low for a weak top score", () => {
    assert.equal(certaintyOf([candidate(0.2), candidate(0.07)]), "low");
  });

  it("is low when the top two are close, however strong the top one is", () => {
    assert.equal(certaintyOf([candidate(0.9), candidate(0.85)]), "low");
  });

  it("is low with no candidates at all", () => {
    assert.equal(certaintyOf([]), "low");
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
