import type { ConfirmDetectionUseCase } from "@/applications/useCases/identify/ConfirmDetectionUseCase";
import type { CreateUploadUseCase } from "@/applications/useCases/identify/CreateUploadUseCase";
import type { IdentifyPlantUseCase } from "@/applications/useCases/identify/IdentifyPlantUseCase";
import type { ListDetectionsUseCase } from "@/applications/useCases/identify/ListDetectionsUseCase";
import type { PresignedUpload, UploadContentType } from "@/infra/clients/s3";
import type {
  ConfirmDetectionResponse,
  DetectionPage,
  IdentifyPlantRequest,
  IdentifyPlantResponse,
} from "@/shared/types/plant";

export class IdentifyController {
  constructor(
    private identifyUseCase: IdentifyPlantUseCase,
    private listDetectionsUseCase: ListDetectionsUseCase,
    private createUploadUseCase: CreateUploadUseCase,
    private confirmDetectionUseCase: ConfirmDetectionUseCase,
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

  async createUpload(
    userId: string,
    contentType: UploadContentType,
  ): Promise<PresignedUpload> {
    return this.createUploadUseCase.execute(userId, contentType);
  }

  // Named rather than positional: three adjacent strings would let a swapped
  // argument compile cleanly and fail at runtime.
  async confirm(request: {
    userId: string;
    detectionId: string;
    species: string;
  }): Promise<ConfirmDetectionResponse> {
    return this.confirmDetectionUseCase.execute(request);
  }
}
