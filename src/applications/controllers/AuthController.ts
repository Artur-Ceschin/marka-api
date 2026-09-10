import type { ConfirmSignUpUseCase } from "@/applications/useCases/auth/ConfirmSignUpUseCase";
import type { ForgotPasswordUseCase } from "@/applications/useCases/auth/ForgotPasswordUseCase";
import type { RefreshTokenUseCase } from "@/applications/useCases/auth/RefreshTokenUseCase";
import type { ResendCodeUseCase } from "@/applications/useCases/auth/ResendCodeUseCase";
import type { ResetPasswordUseCase } from "@/applications/useCases/auth/ResetPasswordUseCase";
import type { SignInUseCase } from "@/applications/useCases/auth/SignInUseCase";
import type { SignUpUseCase } from "@/applications/useCases/auth/SignUpUseCase";
import type {
  ConfirmSignUpRequest,
  ConfirmSignUpResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  RefreshRequest,
  RefreshResponse,
  ResendCodeRequest,
  ResendCodeResponse,
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
    private refreshTokenUseCase: RefreshTokenUseCase,
    private resendCodeUseCase: ResendCodeUseCase,
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

  async refresh(request: RefreshRequest): Promise<RefreshResponse> {
    return this.refreshTokenUseCase.execute(request);
  }

  async resendCode(request: ResendCodeRequest): Promise<ResendCodeResponse> {
    return this.resendCodeUseCase.execute(request);
  }
}
