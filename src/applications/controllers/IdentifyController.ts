import type { ConfirmDetectionUseCase } from "@/applications/useCases/identify/ConfirmDetectionUseCase";
import type { CreateUploadUseCase } from "@/applications/useCases/identify/CreateUploadUseCase";
import type { DeleteDetectionUseCase } from "@/applications/useCases/identify/DeleteDetectionUseCase";
import type { GetDetectionUseCase } from "@/applications/useCases/identify/GetDetectionUseCase";
import type { IdentifyPlantUseCase } from "@/applications/useCases/identify/IdentifyPlantUseCase";
import type { ListDetectionsUseCase } from "@/applications/useCases/identify/ListDetectionsUseCase";
import type { UpdateDetectionUseCase } from "@/applications/useCases/identify/UpdateDetectionUseCase";
import type { PresignedUpload, UploadContentType } from "@/infra/clients/s3";
import type { Locale } from "@/shared/locale";
import type {
  ConfirmDetectionResponse,
  DetectionChanges,
  DetectionKey,
  DetectionPage,
  DetectionView,
  IdentifyPlantRequest,
  IdentifyPlantResponse,
} from "@/shared/types/plant";

export class IdentifyController {
  constructor(
    private identifyUseCase: IdentifyPlantUseCase,
    private listDetectionsUseCase: ListDetectionsUseCase,
    private createUploadUseCase: CreateUploadUseCase,
    private confirmDetectionUseCase: ConfirmDetectionUseCase,
    private getDetectionUseCase: GetDetectionUseCase,
    private updateDetectionUseCase: UpdateDetectionUseCase,
    private deleteDetectionUseCase: DeleteDetectionUseCase,
  ) {}

  async identify(
    request: IdentifyPlantRequest & { userId: string },
  ): Promise<IdentifyPlantResponse> {
    return this.identifyUseCase.execute(request);
  }

  async listDetections(
    userId: string,
    options: { limit?: number; cursor?: string | undefined },
  ): Promise<DetectionPage<DetectionView>> {
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
    identificationToken: string;
    species: string;
    locale: Locale;
  }): Promise<ConfirmDetectionResponse> {
    return this.confirmDetectionUseCase.execute(request);
  }

  async getDetection(key: DetectionKey): Promise<DetectionView> {
    return this.getDetectionUseCase.execute(key);
  }

  async updateDetection(
    key: DetectionKey,
    changes: DetectionChanges,
  ): Promise<DetectionView> {
    return this.updateDetectionUseCase.execute(key, changes);
  }

  async deleteDetection(key: DetectionKey): Promise<void> {
    return this.deleteDetectionUseCase.execute(key);
  }
}
