import { IdentifyController } from "@/applications/controllers/IdentifyController";
import { ConfirmDetectionUseCase } from "@/applications/useCases/identify/ConfirmDetectionUseCase";
import { CreateUploadUseCase } from "@/applications/useCases/identify/CreateUploadUseCase";
import { IdentifyPlantUseCase } from "@/applications/useCases/identify/IdentifyPlantUseCase";
import { ListDetectionsUseCase } from "@/applications/useCases/identify/ListDetectionsUseCase";
import { PlantBucket } from "@/infra/clients/s3";
import { plantEnrichment } from "@/infra/gateways/enrichment";
import { plantIdentification } from "@/infra/gateways/plantNet";
import { DetectionsRepository } from "@/infra/repositories/detectionsRepository";

// Built on first request for the same reason as makeAuthController: server.ts
// loads every route in one process, so eager construction would break /health
// when the bucket or table env vars are unset.
let controller: IdentifyController | null = null;

export function makeIdentifyController(): IdentifyController {
  if (!controller) {
    const detections = new DetectionsRepository();
    const bucket = new PlantBucket();

    controller = new IdentifyController(
      new IdentifyPlantUseCase(bucket, plantIdentification, detections, () =>
        DetectionsRepository.newId(),
      ),
      new ListDetectionsUseCase(detections),
      new CreateUploadUseCase(bucket),
      new ConfirmDetectionUseCase(detections, bucket, plantEnrichment),
    );
  }

  return controller;
}
