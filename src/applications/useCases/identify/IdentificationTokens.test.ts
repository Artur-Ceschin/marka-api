import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IDENTIFICATION_TTL_SECONDS,
  IdentificationTokens,
} from "@/applications/useCases/identify/IdentificationTokens";
import { AppError } from "@/kernel/errors/AppError";

const USER = "b428a418-2001-70dc-2a7c-ab479eb808fc";
const NOW = Date.parse("2026-09-14T12:00:00.000Z");

const tokens = new IdentificationTokens("test-secret");

const CLAIMS = {
  userId: USER,
  detectionId: "2026-09-14T12:00:00.000Z#abcd1234",
  key: `uploads/${USER}/abc`,
  candidates: [
    {
      species: "Rosa gallica",
      scientificName: "Rosa gallica L.",
      commonNames: [],
      family: "Rosaceae",
      genus: "Rosa",
      confidence: 0.9,
      images: [],
    },
  ],
  certainty: "high" as const,
  identifiedAt: "2026-09-14T12:00:00.000Z",
};

const hasCode = (code: string) => (error: unknown) =>
  error instanceof AppError && error.code === code;

describe("IdentificationTokens", () => {
  it("reads back exactly what it issued", () => {
    const token = tokens.issue(CLAIMS, NOW);

    const claims = tokens.read(token, USER, NOW);

    assert.deepEqual(claims.candidates, CLAIMS.candidates);
    assert.equal(claims.key, CLAIMS.key);
  });

  it("rejects a token whose candidates were edited", () => {
    // The attack this exists for: add a species, keep the old signature.
    const [body, signature] = tokens.issue(CLAIMS, NOW).split(".");
    const edited = JSON.parse(Buffer.from(body ?? "", "base64url").toString());
    edited.candidates.push({ species: "Cannabis sativa" });
    const forged = `${Buffer.from(JSON.stringify(edited)).toString("base64url")}.${signature}`;

    assert.throws(
      () => tokens.read(forged, USER, NOW),
      hasCode("INVALID_IDENTIFICATION"),
    );
  });

  it("rejects a token signed with a different secret", () => {
    const token = new IdentificationTokens("other-secret").issue(CLAIMS, NOW);

    assert.throws(
      () => tokens.read(token, USER, NOW),
      hasCode("INVALID_IDENTIFICATION"),
    );
  });

  it("rejects another user's token", () => {
    const token = tokens.issue(CLAIMS, NOW);

    assert.throws(
      () => tokens.read(token, "someone-else", NOW),
      hasCode("INVALID_IDENTIFICATION"),
    );
  });

  it("expires after the TTL", () => {
    const token = tokens.issue(CLAIMS, NOW);
    const later = NOW + (IDENTIFICATION_TTL_SECONDS + 1) * 1000;

    assert.throws(
      () => tokens.read(token, USER, later),
      hasCode("IDENTIFICATION_EXPIRED"),
    );
  });

  it("rejects garbage without throwing anything but a 400", () => {
    for (const garbage of ["", "abc", "a.b.c", "not-base64.sig"]) {
      assert.throws(
        () => tokens.read(garbage, USER, NOW),
        hasCode("INVALID_IDENTIFICATION"),
      );
    }
  });
});
