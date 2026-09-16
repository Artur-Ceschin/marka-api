import { AuthController } from "@/applications/controllers/AuthController";
import { ConfirmSignUpUseCase } from "@/applications/useCases/auth/ConfirmSignUpUseCase";
import { ForgotPasswordUseCase } from "@/applications/useCases/auth/ForgotPasswordUseCase";
import { GetProfileUseCase } from "@/applications/useCases/auth/GetProfileUseCase";
import { RefreshTokenUseCase } from "@/applications/useCases/auth/RefreshTokenUseCase";
import { ResendCodeUseCase } from "@/applications/useCases/auth/ResendCodeUseCase";
import { ResetPasswordUseCase } from "@/applications/useCases/auth/ResetPasswordUseCase";
import { SignInUseCase } from "@/applications/useCases/auth/SignInUseCase";
import { SignOutUseCase } from "@/applications/useCases/auth/SignOutUseCase";
import { SignUpUseCase } from "@/applications/useCases/auth/SignUpUseCase";
import { CognitoGateway } from "@/infra/gateways/cognito";
import { UsersRepository } from "@/infra/repositories/usersRepository";
import { lazy } from "@/kernel/lazy";

// Built on first request, not at import: server.ts loads every route in one
// process, so eager construction would break /health when env vars are unset.
export const makeAuthController = lazy(() => {
  const cognito = new CognitoGateway();
  const users = new UsersRepository();

  return new AuthController(
    new SignUpUseCase(cognito, users),
    new ConfirmSignUpUseCase(cognito, users),
    new SignInUseCase(cognito),
    new ForgotPasswordUseCase(cognito),
    new ResetPasswordUseCase(cognito),
    new RefreshTokenUseCase(cognito),
    new ResendCodeUseCase(cognito),
    new GetProfileUseCase(users),
    new SignOutUseCase(cognito),
  );
});
