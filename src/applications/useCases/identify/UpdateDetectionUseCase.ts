import {
  detectionNotFound,
  toDetectionView,
} from "@/applications/useCases/identify/detectionView";
import type { PlantBucket } from "@/infra/clients/s3";
import type { DetectionsRepository } from "@/infra/repositories/detectionsRepository";
import type {
  DetectionChanges,
  DetectionKey,
  DetectionView,
} from "@/shared/types/plant";

type Detections = Pick<DetectionsRepository, "update">;
type Bucket = Pick<PlantBucket, "imageUrl">;

export class UpdateDetectionUseCase {
  constructor(
    private detections: Detections,
    private plantBucket: Bucket,
  ) {}

  async execute(
    { userId, detectionId }: DetectionKey,
    changes: DetectionChanges,
  ): Promise<DetectionView> {
    // No read first. The write's condition is what proves the row exists for
    // this user, so a separate read would only open a gap for a delete to land in.
    const updated = await this.detections.update(userId, detectionId, changes);

    if (!updated) {
      throw detectionNotFound();
    }

    return toDetectionView(updated, this.plantBucket);
  }
}
