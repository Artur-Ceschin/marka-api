import { ConfirmSignUpUseCase } from "@/applications/useCases/ConfirmSignUpUseCase";
import { ForgotPasswordUseCase } from "@/applications/useCases/ForgotPasswordUseCase";
import { ResetPasswordUseCase } from "@/applications/useCases/ResetPasswordUseCase";
import { SignInUseCase } from "@/applications/useCases/SignInUseCase";
import { SignUpUseCase } from "@/applications/useCases/SignUpUseCase";
import {
  ConfirmSignUpRequest,
  ConfirmSignUpResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  SignInRequest,
  SignInResponse,
  SignUpRequest,
  SignUpResponse,
} from "@/shared/types/auth";

export class AuthController {
  constructor(
    private signUpUseCase: SignUpUseCase,
    private confirmSignUpUseCase: ConfirmSignUpUseCase,
    private signInUseCase: SignInUseCase,
    private forgotPasswordUseCase: ForgotPasswordUseCase,
    private resetPasswordUseCase: ResetPasswordUseCase,
  ) {}

  async signUp(request: SignUpRequest): Promise<SignUpResponse> {
    return this.signUpUseCase.execute(request);
  }

  async confirmSignUp(
    request: ConfirmSignUpRequest,
  ): Promise<ConfirmSignUpResponse> {
    return this.confirmSignUpUseCase.execute(request);
  }

  async signIn(request: SignInRequest): Promise<SignInResponse> {
    return this.signInUseCase.execute(request);
  }

  async forgotPassword(
    request: ForgotPasswordRequest,
  ): Promise<ForgotPasswordResponse> {
    return this.forgotPasswordUseCase.execute(request);
  }

  async resetPassword(
    request: ResetPasswordRequest,
  ): Promise<ResetPasswordResponse> {
    return this.resetPasswordUseCase.execute(request);
  }
}
