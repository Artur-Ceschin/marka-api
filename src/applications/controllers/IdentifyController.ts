import type { IdentifyPlantUseCase } from "@/applications/useCases/identify/IdentifyPlantUseCase";
import type { ListDetectionsUseCase } from "@/applications/useCases/identify/ListDetectionsUseCase";
import type {
  DetectionPage,
  IdentifyPlantRequest,
  IdentifyPlantResponse,
} from "@/shared/types/plant";

export class IdentifyController {
  constructor(
    private identifyUseCase: IdentifyPlantUseCase,
    private listDetectionsUseCase: ListDetectionsUseCase,
  ) {}

  async identify(
    request: IdentifyPlantRequest & { userId: string },
  ): Promise<IdentifyPlantResponse> {
    return this.identifyUseCase.execute(request);
  }

  async listDetections(
    userId: string,
    options: { limit?: number; cursor?: string | undefined },
  ): Promise<DetectionPage> {
    return this.listDetectionsUseCase.execute(userId, options);
  }
}
