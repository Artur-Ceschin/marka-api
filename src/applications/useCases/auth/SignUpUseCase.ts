import { CognitoGateway } from "@/infra/gateways/cognito";
import { UsersRepository } from "@/infra/repositories/usersRepository";
import { SignUpRequest, SignUpResponse } from "@/shared/types/auth";

type SignUpCognito = Pick<CognitoGateway, "signUp">;
type SignUpUsers = Pick<UsersRepository, "create">;

export class SignUpUseCase {
  constructor(
    private cognito: SignUpCognito,
    private users: SignUpUsers,
  ) {}

  async execute({ email, password }: SignUpRequest): Promise<SignUpResponse> {
    const userId = await this.cognito.signUp({ email, password });

    await this.users.create({
      userId,
      email,
      emailVerified: false,
      createdAt: new Date().toISOString(),
    });

    return {
      success: true,
      userId,
      message: "Account created. Check your email for a confirmation code",
    };
  }
}
