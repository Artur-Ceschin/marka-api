import type { CognitoGateway } from "@/infra/gateways/cognito";
import type {
  ResendCodeRequest,
  ResendCodeResponse,
} from "@/shared/types/auth";

type ResendCognito = Pick<CognitoGateway, "resendConfirmationCode">;

export class ResendCodeUseCase {
  constructor(private cognito: ResendCognito) {}

  async execute({ email }: ResendCodeRequest): Promise<ResendCodeResponse> {
    await this.cognito.resendConfirmationCode({ email });

    return {
      success: true,
      message: "If that email needs confirming, a new code is on its way",
    };
  }
}
