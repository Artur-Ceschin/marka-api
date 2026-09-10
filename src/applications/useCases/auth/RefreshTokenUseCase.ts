import type { CognitoGateway } from "@/infra/gateways/cognito";
import type { RefreshRequest, RefreshResponse } from "@/shared/types/auth";

type RefreshCognito = Pick<CognitoGateway, "refresh">;

export class RefreshTokenUseCase {
  constructor(private cognito: RefreshCognito) {}

  async execute(request: RefreshRequest): Promise<RefreshResponse> {
    const tokens = await this.cognito.refresh(request);

    return {
      success: true,
      ...tokens,
    };
  }
}
