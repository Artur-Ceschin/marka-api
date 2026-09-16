import { toDetectionView } from "@/applications/useCases/identify/detectionView";
import type { IdentificationTokens } from "@/applications/useCases/identify/IdentificationTokens";
import type { PlantBucket } from "@/infra/clients/s3";
import type { PlantEnrichmentGateway } from "@/infra/gateways/enrichment";
import type { DetectionsRepository } from "@/infra/repositories/detectionsRepository";
import { AppError } from "@/kernel/errors/AppError";
import type { Locale } from "@/shared/locale";
import type {
  ConfirmDetectionResponse,
  Detection,
  Location,
  PlantEnrichment,
} from "@/shared/types/plant";

type Bucket = Pick<PlantBucket, "getObject" | "persist" | "imageUrl">;
type Enricher = Pick<PlantEnrichmentGateway, "enrich">;
type Detections = Pick<DetectionsRepository, "findById" | "create">;
type Tokens = Pick<IdentificationTokens, "read">;

const alreadyConfirmed = () =>
  new AppError(
    409,
    "DETECTION_ALREADY_CONFIRMED",
    "This identification has already been saved",
  );

export class ConfirmDetectionUseCase {
  constructor(
    private detections: Detections,
    private plantBucket: Bucket,
    private enrichment: Enricher,
    private tokens: Tokens,
  ) {}

  async execute({
    userId,
    identificationToken,
    species,
    locale,
  }: {
    userId: string;
    identificationToken: string;
    species: string;
    locale: Locale;
  }): Promise<ConfirmDetectionResponse> {
    // Signature, owner and expiry — the token stands in for the database row
    // /identify no longer writes.
    const claims = this.tokens.read(identificationToken, userId);

    // The species must be one PlantNet actually proposed. Without this the
    // endpoint becomes a free "write me care instructions for anything"
    // call, and the stored result would no longer reflect an identification.
    const isCandidate = claims.candidates.some(
      (candidate) => candidate.species === species,
    );

    if (!isCandidate) {
      throw new AppError(
        400,
        "SPECIES_NOT_A_CANDIDATE",
        "That species was not one of the suggested matches",
      );
    }

    // Checked before enrichment, so replaying a token does not pay for a
    // second LLM call only to be rejected at the write.
    if (await this.detections.findById(userId, claims.detectionId)) {
      throw alreadyConfirmed();
    }

    const image = await this.plantBucket.getObject(claims.key);
    // The language at the moment of saving, not at identification: that is
    // the language the stored care text will be read in.
    const enrichment = await this.enrichOrSkip({
      species,
      image,
      location: claims.location,
      locale,
    });

    // Copied out of uploads/ only now: a species was chosen and nothing above
    // failed, so there is a detection to keep the image for.
    const imageKey = await this.plantBucket.persist(claims.key);

    const detection: Detection = {
      userId,
      detectionId: claims.detectionId,
      imageKey,
      candidates: claims.candidates,
      certainty: claims.certainty,
      status: "confirmed",
      location: claims.location,
      observedAt: claims.observedAt,
      createdAt: claims.identifiedAt,
      locale,
      confirmedSpecies: species,
      enrichment,
      confirmedAt: new Date().toISOString(),
    };

    // Conditional on the id being new: two requests racing past the check
    // above still produce a single detection.
    if (!(await this.detections.create(detection))) {
      throw alreadyConfirmed();
    }

    return {
      success: true,
      ...(await toDetectionView(detection, this.plantBucket)),
    };
  }

  // A refusal is the model declining to describe this species, not a failure:
  // the user's choice still stands, so it is saved without care text. Any other
  // error propagates before anything is written, so the same token can retry.
  private async enrichOrSkip(request: {
    species: string;
    image: Buffer;
    location: Location | undefined;
    locale: Locale;
  }): Promise<PlantEnrichment | undefined> {
    try {
      return await this.enrichment.enrich(request);
    } catch (error) {
      if (error instanceof AppError && error.code === "ENRICHMENT_REFUSED") {
        return undefined;
      }
      throw error;
    }
  }
}
