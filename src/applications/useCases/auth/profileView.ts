import type { PlantBucket } from "@/infra/clients/s3";
import type { ProfileView, UserProfile } from "@/shared/types/auth";

/**
 * Swaps the stored S3 key for a signed URL the client can load.
 *
 * The key never leaves the API. It is not secret — it contains only the
 * caller's own userId and a uuid — but returning it would invite clients to
 * build their own URLs against a private bucket, which cannot work, and it
 * would leak the storage layout into a contract we would then have to keep.
 *
 * `imageUrl` rounds its signing time down to the hour, so a profile fetched
 * twice in the same hour yields a byte-identical URL and the browser reuses
 * its cached avatar instead of re-downloading it on every page load.
 */
export async function toProfileView(
  profile: UserProfile,
  bucket: Pick<PlantBucket, "imageUrl">,
): Promise<ProfileView> {
  const { avatarKey, ...rest } = profile;

  return {
    ...rest,
    avatarUrl: avatarKey ? await bucket.imageUrl(avatarKey) : undefined,
  };
}
