import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UpdateDetectionUseCase } from "@/applications/useCases/identify/UpdateDetectionUseCase";
import { AppError } from "@/kernel/errors/AppError";
import type { Detection } from "@/shared/types/plant";

const USER = "b428a418-2001-70dc-2a7c-ab479eb808fc";
const KEY = { userId: USER, detectionId: "2026-09-10T12:00:00.000Z#abcd1234" };

const bucket = {
  imageUrl: async (key: string) => `https://signed.test/${key}`,
};

describe("UpdateDetectionUseCase", () => {
  it("returns the updated detection with a loadable image URL", async () => {
    const detections = {
      update: async () =>
        ({
          ...KEY,
          imageKey: `detections/${USER}/abc`,
          notes: "By the gate",
        }) as Detection,
    };

    const result = await new UpdateDetectionUseCase(detections, bucket).execute(
      KEY,
      { notes: "By the gate" },
    );

    assert.equal(result.notes, "By the gate");
    assert.equal(result.imageUrl, `https://signed.test/detections/${USER}/abc`);
  });

  it("is a 404 when the conditional write matched no row", async () => {
    const detections = { update: async () => undefined };

    await assert.rejects(
      () =>
        new UpdateDetectionUseCase(detections, bucket).execute(KEY, {
          notes: "x",
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === "DETECTION_NOT_FOUND",
    );
  });
});
