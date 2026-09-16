import { IdentifyController } from "@/applications/controllers/IdentifyController";
import { ConfirmDetectionUseCase } from "@/applications/useCases/identify/ConfirmDetectionUseCase";
import { CreateUploadUseCase } from "@/applications/useCases/identify/CreateUploadUseCase";
import { DeleteDetectionUseCase } from "@/applications/useCases/identify/DeleteDetectionUseCase";
import { GetDetectionUseCase } from "@/applications/useCases/identify/GetDetectionUseCase";
import { IdentificationTokens } from "@/applications/useCases/identify/IdentificationTokens";
import { IdentifyPlantUseCase } from "@/applications/useCases/identify/IdentifyPlantUseCase";
import { ListDetectionsUseCase } from "@/applications/useCases/identify/ListDetectionsUseCase";
import { UpdateDetectionUseCase } from "@/applications/useCases/identify/UpdateDetectionUseCase";
import { PlantBucket } from "@/infra/clients/s3";
import { plantEnrichment } from "@/infra/gateways/enrichment";
import { plantIdentification } from "@/infra/gateways/plantNet";
import { DetectionsRepository } from "@/infra/repositories/detectionsRepository";
import { UsageRepository } from "@/infra/repositories/usageRepository";
import { lazy } from "@/kernel/lazy";
import { requireEnv } from "@/shared/env";

// Built on first request, not at import: server.ts loads every route in one
// process, so eager construction would break /health when env vars are unset.
export const makeIdentifyController = lazy(() => {
  const detections = new DetectionsRepository();
  const bucket = new PlantBucket();
  const tokens = new IdentificationTokens(
    requireEnv("IDENTIFICATION_TOKEN_SECRET"),
  );

  return new IdentifyController(
    new IdentifyPlantUseCase(
      bucket,
      plantIdentification,
      new UsageRepository(),
      tokens,
      () => DetectionsRepository.newId(),
    ),
    new ListDetectionsUseCase(detections, bucket),
    new CreateUploadUseCase(bucket),
    new ConfirmDetectionUseCase(detections, bucket, plantEnrichment, tokens),
    new GetDetectionUseCase(detections, bucket),
    new UpdateDetectionUseCase(detections, bucket),
    new DeleteDetectionUseCase(detections, bucket),
  );
});
