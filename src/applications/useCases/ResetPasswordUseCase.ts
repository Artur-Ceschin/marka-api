import { CognitoGateway } from "@/infra/gateways/cognito";
import {
  ResetPasswordRequest,
  ResetPasswordResponse,
} from "@/shared/types/auth";

type ResetPasswordCognito = Pick<CognitoGateway, "confirmForgotPassword">;

export class ResetPasswordUseCase {
  constructor(private cognito: ResetPasswordCognito) {}

  async execute(request: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    await this.cognito.confirmForgotPassword(request);

    return {
      success: true,
      message: "Password updated. You can sign in now",
    };
  }
}
