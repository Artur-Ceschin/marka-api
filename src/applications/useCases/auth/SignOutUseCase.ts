import type { CognitoGateway } from "@/infra/gateways/cognito";

type SignOutCognito = Pick<CognitoGateway, "revokeRefreshToken">;

export class SignOutUseCase {
  constructor(private cognito: SignOutCognito) {}

  async execute({ refreshToken }: { refreshToken: string }): Promise<void> {
    await this.cognito.revokeRefreshToken(refreshToken);
  }
}
