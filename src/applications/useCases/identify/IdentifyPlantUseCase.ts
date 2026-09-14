import { PlantBucket } from "@/infra/clients/s3";
import type { PlantIdentification } from "@/infra/gateways/plantNet";
import type { DetectionsRepository } from "@/infra/repositories/detectionsRepository";
import type { UsageRepository } from "@/infra/repositories/usageRepository";
import type {
  IdentifyPlantRequest,
  IdentifyPlantResponse,
} from "@/shared/types/plant";

type Bucket = Pick<PlantBucket, "getObject" | "persist">;
type Identifier = Pick<PlantIdentification, "identify">;
type Detections = Pick<DetectionsRepository, "save">;
type Usage = Pick<UsageRepository, "claimIdentification">;

export class IdentifyPlantUseCase {
  constructor(
    private plantBucket: Bucket,
    private plantIdentification: Identifier,
    private detections: Detections,
    private usage: Usage,
    private newDetectionId: () => string,
  ) {}

  async execute(
    request: IdentifyPlantRequest & { userId: string },
  ): Promise<IdentifyPlantResponse> {
    // The key encodes its owner, so another user's key is rejected before any
    // S3 or PlantNet call is made.
    PlantBucket.assertOwnedBy(request.key, request.userId);

    // Doubles as the upload check: a key that was never uploaded to fails
    // here with a 404, before a quota credit or a PlantNet call is spent.
    const image = await this.plantBucket.getObject(request.key);

    const quota = await this.usage.claimIdentification(request.userId);
    const candidates = await this.plantIdentification.identify(image);

    // Copied out of uploads/ only once there is a detection to keep it for, so
    // a failed identification leaves nothing durable behind.
    const imageKey = await this.plantBucket.persist(request.key);

    const detectionId = this.newDetectionId();
    const createdAt = new Date().toISOString();
    const status = "pending_confirmation";

    await this.detections.save({
      userId: request.userId,
      detectionId,
      imageKey,
      candidates,
      status,
      location: request.location,
      createdAt,
    });

    return {
      success: true,
      detectionId,
      candidates,
      status,
      timestamp: createdAt,
      quota,
    };
  }
}
