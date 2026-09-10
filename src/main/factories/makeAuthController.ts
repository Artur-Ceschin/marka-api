import { AuthController } from "@/applications/controllers/AuthController";
import { ConfirmSignUpUseCase } from "@/applications/useCases/ConfirmSignUpUseCase";
import { ForgotPasswordUseCase } from "@/applications/useCases/ForgotPasswordUseCase";
import { ResetPasswordUseCase } from "@/applications/useCases/ResetPasswordUseCase";
import { SignInUseCase } from "@/applications/useCases/SignInUseCase";
import { SignUpUseCase } from "@/applications/useCases/SignUpUseCase";
import { CognitoGateway } from "@/infra/gateways/cognito";
import { UsersRepository } from "@/infra/repositories/usersRepository";

// Built on first request, not at import: server.ts loads every route in one
// process, so eager construction would break /health when Cognito env is unset.
let controller: AuthController | null = null;

export function makeAuthController(): AuthController {
  if (!controller) {
    const cognito = new CognitoGateway();
    const users = new UsersRepository();

    controller = new AuthController(
      new SignUpUseCase(cognito, users),
      new ConfirmSignUpUseCase(cognito, users),
      new SignInUseCase(cognito),
      new ForgotPasswordUseCase(cognito),
      new ResetPasswordUseCase(cognito),
    );
  }

  return controller;
}
