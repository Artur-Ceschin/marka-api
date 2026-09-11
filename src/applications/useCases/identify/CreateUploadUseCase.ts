import type {
  PlantBucket,
  PresignedUpload,
  UploadContentType,
} from "@/infra/clients/s3";

type Bucket = Pick<PlantBucket, "createUpload">;

export class CreateUploadUseCase {
  constructor(private plantBucket: Bucket) {}

  async execute(
    userId: string,
    contentType: UploadContentType,
  ): Promise<PresignedUpload> {
    return this.plantBucket.createUpload(userId, contentType);
  }
}
