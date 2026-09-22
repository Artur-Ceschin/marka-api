import type {
  PlantBucket,
  PresignedUpload,
  UploadContentType,
} from "@/infra/clients/s3";

type Bucket = Pick<PlantBucket, "createUpload">;

/**
 * Hands back a presigned POST for a new profile photo.
 *
 * Identical to the plant upload on purpose — same prefix, same conditions, so
 * the client reuses whatever it already wrote to POST a file to S3. The photo
 * lands under `uploads/`, which the lifecycle rule expires after 7 days; only
 * PATCH /me promotes it to the durable `avatars/` prefix. That is what keeps a
 * user who picks a photo and never saves from leaving a billed object behind.
 */
export class CreateAvatarUploadUseCase {
  constructor(private bucket: Bucket) {}

  execute(
    userId: string,
    contentType: UploadContentType,
  ): Promise<PresignedUpload> {
    return this.bucket.createUpload(userId, contentType);
  }
}
