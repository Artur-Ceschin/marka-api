import { IdentifyPlantRequest, IdentifyPlantResponse } from "@/shared/types/plant";
import { PlantIdentification } from "@/infra/gateways/plantNet";
import { PlantBucket } from "@/infra/clients/s3";

export class IdentifyPlantUseCase {
  constructor(
    private plantBucket: PlantBucket,
    private plantIdentification: PlantIdentification,
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
