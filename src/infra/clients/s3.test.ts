import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PlantBucket } from "@/infra/clients/s3";
import { AppError } from "@/kernel/errors/AppError";

const USER = "b428a418-2001-70dc-2a7c-ab479eb808fc";
const OTHER = "a468e4a8-40a1-7074-730b-27a27e6ab4db";

describe("PlantBucket.assertOwnedBy", () => {
  it("accepts a key issued to the caller", () => {
    PlantBucket.assertOwnedBy(PlantBucket.keyFor(USER), USER);
  });

  it("rejects another user's key", () => {
    // The whole isolation guarantee: /identify takes a key from the client,
    // so without this check user A could pass user B's key and read their
    // image into a detection of their own.
    assert.throws(
      () => PlantBucket.assertOwnedBy(PlantBucket.keyFor(OTHER), USER),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  it("rejects a key that only looks like a prefix match", () => {
    // `uploads/<user>evil/...` starts with `uploads/<user>` but is a
    // different user. The trailing slash in the check is what stops it.
    assert.throws(() =>
      PlantBucket.assertOwnedBy(`uploads/${USER}evil/abc`, USER),
    );
  });

  it("rejects path traversal out of the caller's prefix", () => {
    assert.throws(() =>
      PlantBucket.assertOwnedBy(`uploads/${OTHER}/../${OTHER}/x`, USER),
    );
  });

  it("issues unguessable keys", () => {
    const keys = new Set(
      Array.from({ length: 100 }, () => PlantBucket.keyFor(USER)),
    );

    assert.equal(keys.size, 100);
  });
});
