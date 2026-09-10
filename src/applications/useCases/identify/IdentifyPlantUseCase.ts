import type { PlantBucket } from "@/infra/clients/s3";
import type { PlantIdentification } from "@/infra/gateways/plantNet";
import type { DetectionsRepository } from "@/infra/repositories/detectionsRepository";
import type {
  IdentifyPlantRequest,
  IdentifyPlantResponse,
} from "@/shared/types/plant";

type Bucket = Pick<PlantBucket, "upload">;
type Identifier = Pick<PlantIdentification, "identify">;
type Detections = Pick<DetectionsRepository, "save">;

export class IdentifyPlantUseCase {
  constructor(
    private plantBucket: Bucket,
    private plantIdentification: Identifier,
    private detections: Detections,
    private newDetectionId: () => string,
  ) {}

  async execute(
    request: IdentifyPlantRequest & { userId: string },
  ): Promise<IdentifyPlantResponse> {
    const imageUrl = await this.plantBucket.upload(request.imageData);

    const plants = await this.plantIdentification.identify(
      imageUrl,
      request.location,
    );

    const createdAt = new Date().toISOString();
    const detectionId = this.newDetectionId();

    await this.detections.save({
      userId: request.userId,
      detectionId,
      imageUrl,
      plants,
      location: request.location,
      createdAt,
    });

    return {
      success: true,
      detectionId,
      plant: plants,
      timestamp: createdAt,
    };
  }
}
