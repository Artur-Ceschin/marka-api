export interface SignUpRequest {
  email: string;
  password: string;
}

export interface ConfirmSignUpRequest {
  email: string;
  code: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserProfile {
  userId: string;
  email: string;
  // Only Google supplies a name; email sign-up never asks for one.
  name?: string | undefined;
  emailVerified: boolean;
  createdAt: string;
}

export type MeResponse = UserProfile & { success: true };

export interface SignUpResponse {
  success: true;
  userId: string;
  message: string;
}

export interface ConfirmSignUpResponse {
  success: true;
  message: string;
}

export interface SignInResponse extends AuthTokens {
  success: true;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  password: string;
}

export interface ForgotPasswordResponse {
  success: true;
  message: string;
}

export interface ResetPasswordResponse {
  success: true;
  message: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface GoogleSignInRequest {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface ResendCodeRequest {
  email: string;
}

export interface RefreshResponse {
  success: true;
  accessToken: string;
  idToken: string;
  expiresIn: number;
}

export interface ResendCodeResponse {
  success: true;
  message: string;
}
