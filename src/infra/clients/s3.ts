import { randomUUID } from "node:crypto";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { makeThumbnail } from "@/infra/images/thumbnail";
import { AppError } from "@/kernel/errors/AppError";
import { isAwsError } from "@/kernel/errors/isAwsError";
import { lazy } from "@/kernel/lazy";
import { env, requireEnv } from "@/shared/env";

export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const UPLOAD_EXPIRES_SECONDS = 300;
const IMAGE_URL_WINDOW_SECONDS = 3600;
const IMAGE_CACHE_CONTROL = "private, max-age=86400, immutable";

// JPEG and PNG only: PlantNet accepts nothing else, so a webp or HEIC upload
// would be stored and then fail at identification. Clients convert first.
export const UPLOAD_CONTENT_TYPES = ["image/jpeg", "image/png"] as const;

export type UploadContentType = (typeof UPLOAD_CONTENT_TYPES)[number];

export interface PresignedUpload {
  url: string;
  fields: Record<string, string>;
  key: string;
  maxBytes: number;
  expiresIn: number;
}

// uploads/ is expired by a lifecycle rule; detections/ is kept.
const UPLOADS = "uploads/";
const DETECTIONS = "detections/";

const s3 = lazy(() => new S3Client({ region: env.AWS_REGION }));

const notFound = () =>
  new AppError(404, "UPLOAD_NOT_FOUND", "Upload not found");

export class PlantBucket {
  private readonly bucket = requireEnv("PLANTS_BUCKET");

  static keyFor(userId: string): string {
    return `${UPLOADS}${userId}/${randomUUID()}`;
  }

  static assertOwnedBy(key: string, userId: string): void {
    if (!key.startsWith(`${UPLOADS}${userId}/`)) {
      throw notFound();
    }
  }

  // Same owner and id under a prefix the lifecycle rule does not touch.
  static durableKeyFor(uploadKey: string): string {
    return DETECTIONS + uploadKey.slice(UPLOADS.length);
  }

  async createUpload(
    userId: string,
    contentType: UploadContentType,
  ): Promise<PresignedUpload> {
    const key = PlantBucket.keyFor(userId);

    const { url, fields } = await createPresignedPost(s3(), {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ["content-length-range", 1, UPLOAD_MAX_BYTES],
        ["eq", "$Content-Type", contentType],
      ],
      Fields: { "Content-Type": contentType },
      Expires: UPLOAD_EXPIRES_SECONDS,
    });

    return {
      url,
      fields,
      key,
      maxBytes: UPLOAD_MAX_BYTES,
      expiresIn: UPLOAD_EXPIRES_SECONDS,
    };
  }

  async getObject(key: string): Promise<Buffer> {
    try {
      const { Body } = await s3().send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );

      if (Body) {
        return Buffer.from(await Body.transformToByteArray());
      }
    } catch (error) {
      // S3 only reports NoSuchKey when the role has s3:ListBucket; without it
      // a missing key is a 403, which would surface here as a 500.
      if (!isAwsError(error, "NoSuchKey")) {
        throw error;
      }
    }

    throw notFound();
  }

  imageUrl(key: string, now = Date.now()): Promise<string> {
    const windowMs = IMAGE_URL_WINDOW_SECONDS * 1000;

    return getSignedUrl(
      s3(),
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseCacheControl: IMAGE_CACHE_CONTROL,
      }),
      {
        expiresIn: 2 * IMAGE_URL_WINDOW_SECONDS,
        signingDate: new Date(now - (now % windowMs)),
      },
    );
  }

  async saveThumbnail(
    imageKey: string,
    image: Buffer,
  ): Promise<string | undefined> {
    const thumbnail = makeThumbnail(image);

    if (!thumbnail) {
      return undefined;
    }

    const key = `${imageKey}-thumb`;

    await s3().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: thumbnail,
        ContentType: "image/jpeg",
      }),
    );

    return key;
  }

  async persist(uploadKey: string): Promise<string> {
    const key = PlantBucket.durableKeyFor(uploadKey);

    await s3().send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: key,
        // CopySource must be URL-encoded; encodeURI keeps the slashes.
        CopySource: encodeURI(`${this.bucket}/${uploadKey}`),
      }),
    );

    return key;
  }

  // S3 answers a delete of a missing key with success, so this is idempotent.
  async deleteObject(key: string): Promise<void> {
    await s3().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
