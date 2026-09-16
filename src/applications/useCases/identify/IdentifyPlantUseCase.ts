import {
  IDENTIFICATION_TTL_SECONDS,
  type IdentificationTokens,
} from "@/applications/useCases/identify/IdentificationTokens";
import { PlantBucket } from "@/infra/clients/s3";
import type { PlantIdentification } from "@/infra/gateways/plantNet";
import type { UsageRepository } from "@/infra/repositories/usageRepository";
import type {
  Certainty,
  IdentifyPlantRequest,
  IdentifyPlantResponse,
  PlantCandidate,
} from "@/shared/types/plant";

type Bucket = Pick<PlantBucket, "getObject">;
type Identifier = Pick<PlantIdentification, "identify">;
type Usage = Pick<UsageRepository, "claimIdentification">;
type Tokens = Pick<IdentificationTokens, "issue">;

// "high" needs a strong top score AND clear daylight over the runner-up:
// 0.9 against 0.85 is a coin flip, however strong 0.9 looks on its own.
const CONFIDENT_SCORE = 0.5;
const CONFIDENT_MARGIN = 0.2;

export function certaintyOf(candidates: PlantCandidate[]): Certainty {
  const [top, runnerUp] = candidates;

  if (!top) {
    return "low";
  }

  const margin = top.confidence - (runnerUp?.confidence ?? 0);

  return top.confidence >= CONFIDENT_SCORE && margin >= CONFIDENT_MARGIN
    ? "high"
    : "low";
}

export class IdentifyPlantUseCase {
  constructor(
    private plantBucket: Bucket,
    private plantIdentification: Identifier,
    private usage: Usage,
    private tokens: Tokens,
    private newDetectionId: () => string,
  ) {}

  async execute(
    request: IdentifyPlantRequest & { userId: string },
  ): Promise<IdentifyPlantResponse> {
    // The key encodes its owner, so another user's key is rejected before any
    // S3 or PlantNet call is made.
    PlantBucket.assertOwnedBy(request.key, request.userId);

    // Doubles as the upload check: a key that was never uploaded to fails
    // here with a 404, before a quota credit or a PlantNet call is spent.
    const image = await this.plantBucket.getObject(request.key);

    const quota = await this.usage.claimIdentification(request.userId);
    const candidates = await this.plantIdentification.identify(
      image,
      request.locale,
    );
    const certainty = certaintyOf(candidates);
    const identifiedAt = new Date().toISOString();

    // Nothing is written here. A result the user walks away from leaves only
    // the upload, which the uploads/ lifecycle rule deletes; the detection and
    // the durable copy of its image are created when a species is picked.
    const identificationToken = this.tokens.issue({
      userId: request.userId,
      detectionId: this.newDetectionId(),
      key: request.key,
      candidates,
      certainty,
      location: request.location,
      observedAt: request.observedAt,
      identifiedAt,
    });

    return {
      success: true,
      identificationToken,
      expiresIn: IDENTIFICATION_TTL_SECONDS,
      candidates,
      certainty,
      timestamp: identifiedAt,
      quota,
    };
  }
}
