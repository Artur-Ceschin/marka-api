import { toProfileView } from "@/applications/useCases/auth/profileView";
import { PlantBucket } from "@/infra/clients/s3";
import type { GeocodingGateway } from "@/infra/gateways/geocoding";
import type { UsersRepository } from "@/infra/repositories/usersRepository";
import { AppError } from "@/kernel/errors/AppError";
import { isAwsError } from "@/kernel/errors/isAwsError";
import type { Locale } from "@/shared/locale";
import type {
  ProfileView,
  ProfileWrite,
  UpdateProfileRequest,
  UserProfile,
} from "@/shared/types/auth";

type Users = Pick<UsersRepository, "findById" | "update">;
type Bucket = Pick<PlantBucket, "imageUrl" | "persist" | "deleteObject">;
type Geocoder = Pick<GeocodingGateway, "describe">;

export class UpdateProfileUseCase {
  constructor(
    private users: Users,
    private bucket: Bucket,
    private geocoder: Geocoder,
  ) {}

  async execute(
    userId: string,
    changes: UpdateProfileRequest,
    locale: Locale = "en",
  ): Promise<ProfileView> {
    const touchesAvatar = changes.avatarKey !== undefined;

    const previous = touchesAvatar
      ? await this.users.findById(userId)
      : undefined;

    const resolved: ProfileWrite = {
      ...changes,
      ...(changes.avatarKey
        ? { avatarKey: await this.promote(changes.avatarKey, userId) }
        : {}),
      ...(await this.nameFor(changes.homeLocation, locale)),
    };

    const updated = await this.users.update(userId, resolved);
    if (!updated) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
    }

    await this.discardReplacedAvatar(previous, updated);

    return toProfileView(updated, this.bucket);
  }

  /**
   * Resolves the place name for a home location, once, at save time.
   *
   * Returns nothing when `homeLocation` is absent, so an unrelated edit — a
   * new bio — never pays for a geocode or overwrites a good name with a
   * failed lookup. Clearing the location clears the name with it, or the
   * profile would show a place the user no longer has.
   *
   * The lookup uses the *rounded* coordinates, the ones actually stored, so
   * the name can never describe a point the row does not contain.
   */
  private async nameFor(
    homeLocation: UpdateProfileRequest["homeLocation"],
    locale: Locale,
  ): Promise<ProfileWrite> {
    if (homeLocation === undefined) {
      return {};
    }

    if (homeLocation === null) {
      return { homeLocationName: null };
    }

    // describe() never throws: a failed lookup stores null and the client
    // falls back to showing the coordinates.
    return {
      homeLocationName:
        (await this.geocoder.describe(homeLocation, locale)) ?? null,
    };
  }

  private async promote(uploadKey: string, userId: string): Promise<string> {
    PlantBucket.assertOwnedBy(uploadKey, userId);

    try {
      return await this.bucket.persist(
        uploadKey,
        PlantBucket.avatarKeyFor(uploadKey),
      );
    } catch (error) {
      // A key that was presigned but never uploaded to. The confirm flow gets
      // this 404 from the getObject it makes anyway for the thumbnail; there
      // is no such read here, so CopyObject is what reports the miss and it
      // would otherwise surface as a 500.
      if (isAwsError(error, "NoSuchKey")) {
        throw new AppError(404, "UPLOAD_NOT_FOUND", "Upload not found");
      }
      throw error;
    }
  }

  private async discardReplacedAvatar(
    previous: UserProfile | undefined,
    updated: UserProfile,
  ): Promise<void> {
    const stale = previous?.avatarKey;

    if (!stale || stale === updated.avatarKey) {
      return;
    }

    await this.bucket.deleteObject(stale).catch((error: unknown) => {
      console.error("[updateProfile] avatar left behind", error);
    });
  }
}
