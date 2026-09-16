import type { PlantBucket } from "@/infra/clients/s3";
import { AppError } from "@/kernel/errors/AppError";
import type { Detection, DetectionView } from "@/shared/types/plant";

// The bucket is private, so each image needs its own signed URL. Signing is
// computed locally rather than requested, so doing it per item is cheap.
export async function toDetectionView(
  detection: Detection,
  bucket: Pick<PlantBucket, "imageUrl">,
): Promise<DetectionView> {
  return { ...detection, imageUrl: await bucket.imageUrl(detection.imageKey) };
}

// Also the answer for another user's detection: every access is keyed by both
// userId and detectionId, so "not yours" and "does not exist" are the same miss.
export const detectionNotFound = () =>
  new AppError(404, "DETECTION_NOT_FOUND", "Detection not found");
