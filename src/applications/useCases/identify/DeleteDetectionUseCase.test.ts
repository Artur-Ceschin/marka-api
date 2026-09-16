import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DeleteDetectionUseCase } from "@/applications/useCases/identify/DeleteDetectionUseCase";
import { AppError } from "@/kernel/errors/AppError";
import type { Detection } from "@/shared/types/plant";

const USER = "b428a418-2001-70dc-2a7c-ab479eb808fc";
const KEY = { userId: USER, detectionId: "2026-09-10T12:00:00.000Z#abcd1234" };
const IMAGE_KEY = `detections/${USER}/abc`;

function makeDeps({
  stored = true,
  imageDeleteFails = false,
}: {
  stored?: boolean;
  imageDeleteFails?: boolean;
} = {}) {
  const deletedImages: string[] = [];

  return {
    deletedImages,
    detections: {
      delete: async () =>
        stored ? ({ ...KEY, imageKey: IMAGE_KEY } as Detection) : undefined,
    },
    bucket: {
      deleteObject: async (key: string) => {
        if (imageDeleteFails) {
          throw new Error("S3 unavailable");
        }
        deletedImages.push(key);
      },
    },
  };
}

describe("DeleteDetectionUseCase", () => {
  it("removes the image the deleted detection pointed at", async () => {
    const deps = makeDeps();

    await new DeleteDetectionUseCase(deps.detections, deps.bucket).execute(KEY);

    assert.deepEqual(deps.deletedImages, [IMAGE_KEY]);
  });

  it("is a 404 without touching S3 when there is no such detection", async () => {
    const deps = makeDeps({ stored: false });

    await assert.rejects(
      () =>
        new DeleteDetectionUseCase(deps.detections, deps.bucket).execute(KEY),
      (error: unknown) =>
        error instanceof AppError && error.code === "DETECTION_NOT_FOUND",
    );
    assert.deepEqual(deps.deletedImages, []);
  });

  it("still succeeds when only the image delete fails", async () => {
    // The row is already gone; reporting failure would make a retry 404.
    const deps = makeDeps({ imageDeleteFails: true });
    const originalError = console.error;
    console.error = () => {};

    try {
      await new DeleteDetectionUseCase(deps.detections, deps.bucket).execute(
        KEY,
      );
    } finally {
      console.error = originalError;
    }
  });
});
