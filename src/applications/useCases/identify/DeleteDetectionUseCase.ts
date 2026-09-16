import { detectionNotFound } from "@/applications/useCases/identify/detectionView";
import type { PlantBucket } from "@/infra/clients/s3";
import type { DetectionsRepository } from "@/infra/repositories/detectionsRepository";
import type { DetectionKey } from "@/shared/types/plant";

type Detections = Pick<DetectionsRepository, "delete">;
type Bucket = Pick<PlantBucket, "deleteObject">;

export class DeleteDetectionUseCase {
  constructor(
    private detections: Detections,
    private plantBucket: Bucket,
  ) {}

  // The daily credit is not refunded: it paid for a PlantNet call that happened.
  async execute({ userId, detectionId }: DetectionKey): Promise<void> {
    const deleted = await this.detections.delete(userId, detectionId);

    if (!deleted) {
      throw detectionNotFound();
    }

    // Row first, image second. The reverse order can leave a detection whose
    // image is gone; this order can only leave an object nothing points at.
    // So a failed image delete is logged rather than returned — the detection
    // the user asked to remove is already gone, and a retry would 404.
    await this.plantBucket
      .deleteObject(deleted.imageKey)
      .catch((error: unknown) => {
        console.error("[deleteDetection] image left behind", error);
      });
  }
}
