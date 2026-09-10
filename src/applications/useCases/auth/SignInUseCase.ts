import type { CognitoGateway } from "@/infra/gateways/cognito";
import type { SignInRequest, SignInResponse } from "@/shared/types/auth";

type SignInCognito = Pick<CognitoGateway, "signIn">;

export class SignInUseCase {
  constructor(private cognito: SignInCognito) {}

  async execute({ email, password }: SignInRequest): Promise<SignInResponse> {
    const tokens = await this.cognito.signIn({ email, password });

    return {
      success: true,
      ...tokens,
    };
  }
}
