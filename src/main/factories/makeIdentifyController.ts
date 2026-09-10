import { IdentifyController } from "@/applications/controllers/IdentifyController";
import { IdentifyPlantUseCase } from "@/applications/useCases/identify/IdentifyPlantUseCase";
import { ListDetectionsUseCase } from "@/applications/useCases/identify/ListDetectionsUseCase";
import { plantBucket } from "@/infra/clients/s3";
import { plantIdentification } from "@/infra/gateways/plantNet";
import { DetectionsRepository } from "@/infra/repositories/detectionsRepository";

// Built on first request for the same reason as makeAuthController: server.ts
// loads every route in one process, so eager construction would break /health
// when the table env var is unset.
let controller: IdentifyController | null = null;

export function makeIdentifyController(): IdentifyController {
  if (!controller) {
    const detections = new DetectionsRepository();

    controller = new IdentifyController(
      new IdentifyPlantUseCase(
        plantBucket,
        plantIdentification,
        detections,
        () => DetectionsRepository.newId(),
      ),
      new ListDetectionsUseCase(detections),
    );
  }

  return controller;
}
