import { IdentifyPlantRequest, IdentifyPlantResponse } from "@/domain/plant";
import { IdentifyPlantUseCase } from "../useCases/IdentifyPlantUseCase";

export class IdentifyController {
  constructor(private identifyUseCase: IdentifyPlantUseCase) {}

  async identify(request: IdentifyPlantRequest): Promise<IdentifyPlantResponse> {
    return this.identifyUseCase.execute(request);
  }
}
