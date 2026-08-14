import { IdentifyPlantRequest, IdentifyPlantResponse } from "@/domain/plant";
import { Identify } from "@/services/plantNet/plantIdentification";
import { PlantBucket } from "@/services/s3/plantBucket";

export class IdentifyPlantUseCase {
  constructor(
    private plantBucket: PlantBucket,
    private plantIdentification: Identify,
  ) {}

  async execute(request: IdentifyPlantRequest): Promise<IdentifyPlantResponse> {
    const imageUrl = await this.plantBucket.upload(request.imageData);

    const plants = await this.plantIdentification.identify(
      imageUrl,
      request.location,
    );

    return {
      success: true,
      plant: plants,
      timestamp: new Date().toISOString(),
    };
  }
}
