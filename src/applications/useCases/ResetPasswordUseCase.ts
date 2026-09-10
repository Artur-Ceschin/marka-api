import { CognitoGateway } from "@/infra/gateways/cognito";
import {
  ResetPasswordRequest,
  ResetPasswordResponse,
} from "@/shared/types/auth";

type ResetPasswordCognito = Pick<CognitoGateway, "confirmForgotPassword">;

export class ResetPasswordUseCase {
  constructor(private cognito: ResetPasswordCognito) {}

  /**
   * No tokens are returned. Completing a reset proves the caller can read the
   * mailbox, not that they intended to start a session — and handing back
   * tokens here would mean a leaked reset code becomes an immediate session
   * rather than something the real owner can still race to change. The client
   * sends them to sign-in with the new password.
   */
  async execute(request: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    await this.cognito.confirmForgotPassword(request);

    return {
      success: true,
      message: "Password updated. You can sign in now",
    };
  }
}
