import type { UsersRepository } from "@/infra/repositories/usersRepository";
import { AppError } from "@/kernel/errors/AppError";
import type { MeResponse, UserProfile } from "@/shared/types/auth";

type Users = Pick<UsersRepository, "findById" | "createIfMissing">;

export class GetProfileUseCase {
  constructor(private users: Users) {}

  async execute(user: {
    sub: string;
    email?: string | undefined;
  }): Promise<MeResponse> {
    const stored = await this.users.findById(user.sub);

    if (stored) {
      return { success: true, ...stored };
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
