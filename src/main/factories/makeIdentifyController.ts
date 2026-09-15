import { IdentifyController } from "@/applications/controllers/IdentifyController";
import { ConfirmDetectionUseCase } from "@/applications/useCases/identify/ConfirmDetectionUseCase";
import { CreateUploadUseCase } from "@/applications/useCases/identify/CreateUploadUseCase";
import { IdentifyPlantUseCase } from "@/applications/useCases/identify/IdentifyPlantUseCase";
import { ListDetectionsUseCase } from "@/applications/useCases/identify/ListDetectionsUseCase";
import { PlantBucket } from "@/infra/clients/s3";
import { plantEnrichment } from "@/infra/gateways/enrichment";
import { plantIdentification } from "@/infra/gateways/plantNet";
import { DetectionsRepository } from "@/infra/repositories/detectionsRepository";
import { UsageRepository } from "@/infra/repositories/usageRepository";
import { lazy } from "@/kernel/lazy";

// Built on first request, not at import: server.ts loads every route in one
// process, so eager construction would break /health when env vars are unset.
export const makeIdentifyController = lazy(() => {
  const detections = new DetectionsRepository();
  const bucket = new PlantBucket();

  return new IdentifyController(
    new IdentifyPlantUseCase(
      bucket,
      plantIdentification,
      detections,
      new UsageRepository(),
      () => DetectionsRepository.newId(),
    ),
    new ListDetectionsUseCase(detections, bucket),
    new CreateUploadUseCase(bucket),
    new ConfirmDetectionUseCase(detections, bucket, plantEnrichment),
  );
});
