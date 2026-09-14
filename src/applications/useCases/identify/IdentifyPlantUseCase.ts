import { PlantBucket } from "@/infra/clients/s3";
import type { PlantIdentification } from "@/infra/gateways/plantNet";
import type { DetectionsRepository } from "@/infra/repositories/detectionsRepository";
import type { UsageRepository } from "@/infra/repositories/usageRepository";
import type {
  IdentifyPlantRequest,
  IdentifyPlantResponse,
} from "@/shared/types/plant";

type Bucket = Pick<PlantBucket, "assertUploaded" | "getObject" | "objectUrl">;
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
    // The key encodes its owner, so this rejects another user's key before
    // any S3 or PlantNet call is made.
    PlantBucket.assertOwnedBy(request.key, request.userId);

    // Confirms the upload actually completed. Without it a client could send
    // a key it never uploaded to and we would pay for the identification.
    await this.plantBucket.assertUploaded(request.key);

    const imageUrl = this.plantBucket.objectUrl(request.key);
    const image = await this.plantBucket.getObject(request.key);

    const quota = await this.usage.claimIdentification(request.userId);

    const plants = await this.plantIdentification.identify(image);

    const createdAt = new Date().toISOString();
    const detectionId = this.newDetectionId();

    await this.detections.save({
      userId: request.userId,
      detectionId,
      imageUrl,
      candidates: plants,
      status: "pending_confirmation",
      location: request.location,
      createdAt,
    });

    return {
      success: true,
      detectionId,
      candidates: plants,
      status: "pending_confirmation",
      timestamp: createdAt,
      quota,
    };
  }
}
