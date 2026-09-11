import { randomUUID } from "node:crypto";
import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { AppError } from "@/kernel/errors/AppError";
import { env } from "@/shared/env";

export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const UPLOAD_EXPIRES_SECONDS = 300;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type UploadContentType = (typeof ALLOWED_TYPES)[number];

export interface PresignedUpload {
  url: string;
  fields: Record<string, string>;
  key: string;
  maxBytes: number;
  expiresIn: number;
}

let client: S3Client | undefined;

function s3(): S3Client {
  client ??= new S3Client({ region: env.AWS_REGION });
  return client;
}

export class PlantBucket {
  private readonly bucket: string;

  constructor() {
    if (!env.PLANTS_BUCKET) {
      throw new Error(
        "PLANTS_BUCKET is required. In deployed environments serverless " +
          "injects it; locally, copy it from `pnpm sls:print` into .env",
      );
    }

    this.bucket = env.PLANTS_BUCKET;
  }

  static keyFor(userId: string): string {
    return `uploads/${userId}/${randomUUID()}`;
  }

  static assertOwnedBy(key: string, userId: string): void {
    if (!key.startsWith(`uploads/${userId}/`)) {
      throw new AppError(404, "UPLOAD_NOT_FOUND", "Upload not found");
    }
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

  /** Confirms the client actually completed the upload before we bill work on it. */
  async assertUploaded(key: string): Promise<void> {
    try {
      await s3().send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      throw new AppError(
        404,
        "UPLOAD_NOT_FOUND",
        "No upload found for that key. Upload the image first",
      );
    }
  }

  async getObject(key: string): Promise<Buffer> {
    const response = await s3().send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    if (!response.Body) {
      throw new AppError(404, "UPLOAD_NOT_FOUND", "Upload not found");
    }

    return Buffer.from(await response.Body.transformToByteArray());
  }

  async getObjectFromUrl(url: string): Promise<Buffer> {
    const prefix = `s3://${this.bucket}/`;
    if (!url.startsWith(prefix)) {
      throw new AppError(404, "UPLOAD_NOT_FOUND", "Upload not found");
    }

    return this.getObject(url.slice(prefix.length));
  }

  objectUrl(key: string): string {
    return `s3://${this.bucket}/${key}`;
  }
}
