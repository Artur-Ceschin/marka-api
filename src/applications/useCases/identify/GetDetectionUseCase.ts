import {
  detectionNotFound,
  toDetectionView,
} from "@/applications/useCases/identify/detectionView";
import type { PlantBucket } from "@/infra/clients/s3";
import type { DetectionsRepository } from "@/infra/repositories/detectionsRepository";
import type { DetectionKey, DetectionView } from "@/shared/types/plant";

type Detections = Pick<DetectionsRepository, "findById">;
type Bucket = Pick<PlantBucket, "imageUrl">;

export class GetDetectionUseCase {
  constructor(
    private detections: Detections,
    private plantBucket: Bucket,
  ) {}

  async execute({ userId, detectionId }: DetectionKey): Promise<DetectionView> {
    const detection = await this.detections.findById(userId, detectionId);

    if (!detection) {
      throw detectionNotFound();
    }

    return toDetectionView(detection, this.plantBucket);
  }
}
