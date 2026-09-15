import type { PlantBucket } from "@/infra/clients/s3";
import type { DetectionsRepository } from "@/infra/repositories/detectionsRepository";
import type { DetectionPage, DetectionView } from "@/shared/types/plant";

type Detections = Pick<DetectionsRepository, "listByUser">;
type Bucket = Pick<PlantBucket, "imageUrl">;

export class ListDetectionsUseCase {
  constructor(
    private detections: Detections,
    private plantBucket: Bucket,
  ) {}

  async execute(
    userId: string,
    options: { limit?: number; cursor?: string | undefined },
  ): Promise<DetectionPage<DetectionView>> {
    const page = await this.detections.listByUser(userId, options);

    // The bucket is private, so each image needs its own signed URL. Signing
    // is computed locally rather than requested, so per item is cheap.
    const items = await Promise.all(
      page.items.map(async (detection) => ({
        ...detection,
        imageUrl: await this.plantBucket.imageUrl(detection.imageKey),
      })),
    );

    return { ...page, items };
  }
}
