import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  homeLocationSchema,
  locationSchema,
} from "@/applications/schemas/location";

describe("homeLocationSchema", () => {
  it("rounds to a neighbourhood rather than a doorstep", () => {
    const home = homeLocationSchema.parse({
      latitude: -23.5613456,
      longitude: -46.6564321,
    });

    assert.deepEqual(home, { latitude: -23.56, longitude: -46.66 });
  });

  it("drops accuracy, which describes a reading and not a chosen place", () => {
    const home = homeLocationSchema.parse({
      latitude: -23.56,
      longitude: -46.66,
      accuracy: 12,
    });

    assert.ok(!("accuracy" in home));
  });

  it("still refuses coordinates that are not on Earth", () => {
    assert.throws(() =>
      homeLocationSchema.parse({ latitude: 91, longitude: 0 }),
    );
  });
});

describe("locationSchema", () => {
  // Detections keep full precision and their accuracy reading; only the home
  // location is coarsened, so lifting the schema out must not have changed it.
  it("leaves a detection's coordinates exactly as sent", () => {
    const location = locationSchema.parse({
      latitude: -23.5613456,
      longitude: -46.6564321,
      accuracy: 12,
    });

    assert.deepEqual(location, {
      latitude: -23.5613456,
      longitude: -46.6564321,
      accuracy: 12,
    });
  });
});
