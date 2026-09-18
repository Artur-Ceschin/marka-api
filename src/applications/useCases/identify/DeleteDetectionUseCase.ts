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

    // So a failed image delete is logged rather than returned — the detection
    // the user asked to remove is already gone, and a retry would 404.
    const keys = [deleted.imageKey, deleted.thumbnailKey].filter(
      (key): key is string => Boolean(key),
    );

    await Promise.all(
      keys.map((key) =>
        this.plantBucket.deleteObject(key).catch((error: unknown) => {
          console.error("[deleteDetection] image left behind", error);
        }),
      ),
    );
  }
}
