import type { CognitoGateway } from "@/infra/gateways/cognito";
import type {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
} from "@/shared/types/auth";

type ForgotPasswordCognito = Pick<CognitoGateway, "forgotPassword">;

export class ForgotPasswordUseCase {
  constructor(private cognito: ForgotPasswordCognito) {}
  async execute({
    email,
  }: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    await this.cognito.forgotPassword({ email });

    return {
      success: true,
      message: "If that email has an account, a reset code is on its way",
    };
  }
}
