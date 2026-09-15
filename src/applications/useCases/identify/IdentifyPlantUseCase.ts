import { PlantBucket } from "@/infra/clients/s3";
import type { PlantIdentification } from "@/infra/gateways/plantNet";
import type { DetectionsRepository } from "@/infra/repositories/detectionsRepository";
import type { UsageRepository } from "@/infra/repositories/usageRepository";
import type {
  Certainty,
  IdentifyPlantRequest,
  IdentifyPlantResponse,
  PlantCandidate,
} from "@/shared/types/plant";

type Bucket = Pick<PlantBucket, "getObject" | "persist">;
type Identifier = Pick<PlantIdentification, "identify">;
type Detections = Pick<DetectionsRepository, "save">;
type Usage = Pick<UsageRepository, "claimIdentification">;

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
    private detections: Detections,
    private usage: Usage,
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
    const candidates = await this.plantIdentification.identify(image);

    // Copied out of uploads/ only once there is a detection to keep it for, so
    // a failed identification leaves nothing durable behind.
    const imageKey = await this.plantBucket.persist(request.key);

    const detectionId = this.newDetectionId();
    const createdAt = new Date().toISOString();
    const status = "pending_confirmation";
    const certainty = certaintyOf(candidates);

    await this.detections.save({
      userId: request.userId,
      detectionId,
      imageKey,
      candidates,
      certainty,
      status,
      location: request.location,
      createdAt,
    });

    return {
      success: true,
      detectionId,
      candidates,
      certainty,
      status,
      timestamp: createdAt,
      quota,
    };
  }
}
