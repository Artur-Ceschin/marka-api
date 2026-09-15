import type { PlantBucket } from "@/infra/clients/s3";
import type { PlantEnrichmentGateway } from "@/infra/gateways/enrichment";
import type { DetectionsRepository } from "@/infra/repositories/detectionsRepository";
import { AppError } from "@/kernel/errors/AppError";
import type { ConfirmDetectionResponse } from "@/shared/types/plant";

type Bucket = Pick<PlantBucket, "getObject">;
type Enricher = Pick<PlantEnrichmentGateway, "enrich">;
type Detections = Pick<DetectionsRepository, "findById" | "confirm">;

const alreadyConfirmed = () =>
  new AppError(
    409,
    "DETECTION_ALREADY_CONFIRMED",
    "This detection has already been confirmed",
  );

export class ConfirmDetectionUseCase {
  constructor(
    private detections: Detections,
    private plantBucket: Bucket,
    private enrichment: Enricher,
  ) {}

  async execute({
    userId,
    detectionId,
    species,
  }: {
    userId: string;
    detectionId: string;
    species: string;
  }): Promise<ConfirmDetectionResponse> {
    // Reading by both key parts means a detection belonging to someone else
    // is simply not found.
    const detection = await this.detections.findById(userId, detectionId);

    if (!detection) {
      throw new AppError(404, "DETECTION_NOT_FOUND", "Detection not found");
    }

    // Checked before enrichment, so a repeated confirm does not pay for a
    // second LLM call only to be rejected when the row is written.
    if (detection.status !== "pending_confirmation") {
      throw alreadyConfirmed();
    }

    // The species must be one PlantNet actually proposed. Without this the
    // endpoint becomes a free "write me care instructions for anything"
    // call, and the stored result would no longer reflect an identification.
    const isCandidate = detection.candidates.some(
      (candidate) => candidate.species === species,
    );

    if (!isCandidate) {
      throw new AppError(
        400,
        "SPECIES_NOT_A_CANDIDATE",
        "That species was not one of the suggested matches",
      );
    }

    const image = await this.plantBucket.getObject(detection.imageKey);

    const enrichment = await this.enrichment.enrich({
      species,
      image,
      location: detection.location,
    });

    const confirmed = await this.detections.confirm({
      userId,
      detectionId,
      species,
      enrichment,
    });

    // Another request confirmed it between the read above and this write.
    if (!confirmed) {
      throw alreadyConfirmed();
    }

    return {
      success: true,
      detectionId,
      species,
      enrichment,
      status: confirmed.status,
    };
  }
}
