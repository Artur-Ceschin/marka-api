import type { IdentifyPlantUseCase } from "@/applications/useCases/identify/IdentifyPlantUseCase";
import type {
  IdentifyPlantRequest,
  IdentifyPlantResponse,
} from "@/shared/types/plant";

export class IdentifyController {
  constructor(private identifyUseCase: IdentifyPlantUseCase) {}

  async identify(
    request: IdentifyPlantRequest,
  ): Promise<IdentifyPlantResponse> {
    return this.identifyUseCase.execute(request);
  }
}
