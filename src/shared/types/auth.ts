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
  emailVerified: boolean;
  createdAt: string;
}

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

/**
 * Both password-reset responses are intentionally featureless. Anything that
 * varies by whether the email is registered turns the endpoint into a way to
 * test which addresses have accounts.
 */
export interface ForgotPasswordResponse {
  success: true;
  message: string;
}

export interface ResetPasswordResponse {
  success: true;
  message: string;
}
