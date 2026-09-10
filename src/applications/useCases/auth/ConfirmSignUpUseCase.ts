import { CognitoGateway } from "@/infra/gateways/cognito";
import { UsersRepository } from "@/infra/repositories/usersRepository";
import {
  ConfirmSignUpRequest,
  ConfirmSignUpResponse,
} from "@/shared/types/auth";

type ConfirmCognito = Pick<CognitoGateway, "confirmSignUp" | "findUserId">;
type ConfirmUsers = Pick<UsersRepository, "markEmailVerified">;

export class ConfirmSignUpUseCase {
  constructor(
    private cognito: ConfirmCognito,
    private users: ConfirmUsers,
  ) {}

  async execute({
    email,
    code,
  }: ConfirmSignUpRequest): Promise<ConfirmSignUpResponse> {
    await this.cognito.confirmSignUp({ email, code });

    const userId = await this.cognito.findUserId(email);
    await this.users.markEmailVerified(userId);

    return {
      success: true,
      message: "Email confirmed. You can sign in now",
    };
  }
}
