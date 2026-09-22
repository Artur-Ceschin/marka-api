import { toProfileView } from "@/applications/useCases/auth/profileView";
import type { PlantBucket } from "@/infra/clients/s3";
import type { UsersRepository } from "@/infra/repositories/usersRepository";
import { AppError } from "@/kernel/errors/AppError";
import type { MeResponse, UserProfile } from "@/shared/types/auth";

type Users = Pick<UsersRepository, "findById" | "createIfMissing">;
type Bucket = Pick<PlantBucket, "imageUrl">;

export class GetProfileUseCase {
  constructor(
    private users: Users,
    private bucket: Bucket,
  ) {}

  async execute(user: {
    sub: string;
    email?: string | undefined;
  }): Promise<MeResponse> {
    const stored = await this.users.findById(user.sub);

    if (stored) {
      return { success: true, ...(await toProfileView(stored, this.bucket)) };
    }

    if (!user.email) {
      throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
    }

    const profile: UserProfile = {
      userId: user.sub,
      email: user.email,
      // Cognito only issues tokens to confirmed users, and Google verifies
      // its own addresses.
      emailVerified: true,
      createdAt: new Date().toISOString(),
    };

    await this.users.createIfMissing(profile);

    return { success: true, ...profile };
  }
}
