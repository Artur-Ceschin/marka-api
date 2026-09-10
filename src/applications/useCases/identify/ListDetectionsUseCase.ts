import type { DetectionsRepository } from "@/infra/repositories/detectionsRepository";
import type { DetectionPage } from "@/shared/types/plant";

type Detections = Pick<DetectionsRepository, "listByUser">;

export class ListDetectionsUseCase {
  constructor(private detections: Detections) {}

  async execute(
    userId: string,
    options: { limit?: number; cursor?: string | undefined },
  ): Promise<DetectionPage> {
    return this.detections.listByUser(userId, options);
  }
}
