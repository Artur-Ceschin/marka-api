import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Presigning is computed locally, so fixed fake credentials are enough and no
// AWS call is made. Set before import: the bucket name is read at construction.
process.env.PLANTS_BUCKET = "marka-test-bucket";
process.env.AWS_ACCESS_KEY_ID = "AKIATESTTESTTESTTEST";
process.env.AWS_SECRET_ACCESS_KEY = "test-secret-access-key";
delete process.env.AWS_SESSION_TOKEN;
delete process.env.AWS_PROFILE;

const { PlantBucket } = await import("@/infra/clients/s3");

const KEY = "detections/user-1/abc";
const HOUR = 60 * 60 * 1000;
const NINE_AM = Date.parse("2026-09-16T09:00:00.000Z");

describe("PlantBucket.imageUrl", () => {
  const bucket = new PlantBucket();

  it("gives the same URL throughout an hour, so the browser can cache it", async () => {
    const early = await bucket.imageUrl(KEY, NINE_AM + 60_000);
    const late = await bucket.imageUrl(KEY, NINE_AM + 59 * 60_000);

    assert.equal(early, late);
  });

  it("signs a new URL once the hour turns", async () => {
    const before = await bucket.imageUrl(KEY, NINE_AM + 59 * 60_000);
    const after = await bucket.imageUrl(KEY, NINE_AM + HOUR);

    assert.notEqual(before, after);
  });

  it("stays valid for at least an hour after it is handed out", async () => {
    // Worst case: issued just before the hour turns.
    const url = new URL(await bucket.imageUrl(KEY, NINE_AM + HOUR - 1));
    const signedAt = url.searchParams.get("X-Amz-Date");
    const expires = Number(url.searchParams.get("X-Amz-Expires"));

    assert.equal(signedAt, "20260916T090000Z");
    assert.equal(expires, 2 * 60 * 60);
  });

  it("tells the browser the image may be cached", async () => {
    const url = new URL(await bucket.imageUrl(KEY, NINE_AM));

    assert.match(
      url.searchParams.get("response-cache-control") ?? "",
      /max-age=\d+/,
    );
  });
});
