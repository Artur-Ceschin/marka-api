import type { ConfirmSignUpUseCase } from "@/applications/useCases/auth/ConfirmSignUpUseCase";
import type { ForgotPasswordUseCase } from "@/applications/useCases/auth/ForgotPasswordUseCase";
import type { GetProfileUseCase } from "@/applications/useCases/auth/GetProfileUseCase";
import type { RefreshTokenUseCase } from "@/applications/useCases/auth/RefreshTokenUseCase";
import type { ResendCodeUseCase } from "@/applications/useCases/auth/ResendCodeUseCase";
import type { ResetPasswordUseCase } from "@/applications/useCases/auth/ResetPasswordUseCase";
import type { SignInUseCase } from "@/applications/useCases/auth/SignInUseCase";
import type { SignInWithGoogleUseCase } from "@/applications/useCases/auth/SignInWithGoogleUseCase";
import type { SignOutUseCase } from "@/applications/useCases/auth/SignOutUseCase";
import type { SignUpUseCase } from "@/applications/useCases/auth/SignUpUseCase";
import type {
  ConfirmSignUpRequest,
  ConfirmSignUpResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  GoogleSignInRequest,
  MeResponse,
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
    private getProfileUseCase: GetProfileUseCase,
    private signOutUseCase: SignOutUseCase,
    private signInWithGoogleUseCase: SignInWithGoogleUseCase,
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

  async signInWithGoogle(
    request: GoogleSignInRequest,
  ): Promise<SignInResponse> {
    return this.signInWithGoogleUseCase.execute(request);
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

  async me(user: {
    sub: string;
    email?: string | undefined;
  }): Promise<MeResponse> {
    return this.getProfileUseCase.execute(user);
  }

  async signOut(request: { refreshToken: string }): Promise<void> {
    return this.signOutUseCase.execute(request);
  }
}
