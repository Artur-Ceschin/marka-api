import type { Location } from "@/shared/types/plant";

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
  name?: string | undefined;
  bio?: string | undefined;
  avatarKey?: string | undefined;
  // Saved so the identify flow can offer it instead of asking the device
  // every time. Stored rounded — see homeLocationSchema.
  homeLocation?: Location | undefined;
  // Resolved once at save time, not per page view. Absent when the lookup
  // failed or no home is set — clients fall back to the coordinates.
  homeLocationName?: string | undefined;
  emailVerified: boolean;
  createdAt: string;
  updatedAt?: string | undefined;
}

export type ProfileView = Omit<UserProfile, "avatarKey"> & {
  avatarUrl?: string | undefined;
};

export type MeResponse = ProfileView & { success: true };

export interface UpdateProfileRequest {
  name?: string | null | undefined;
  bio?: string | null | undefined;
  avatarKey?: string | null | undefined;
  homeLocation?: Location | null | undefined;
}

// What the repository may write: everything a client can send, plus the
// fields the API derives for itself. Keeping these apart is what stops a
// client posting its own homeLocationName that contradicts the coordinates.
export interface ProfileWrite extends UpdateProfileRequest {
  homeLocationName?: string | null | undefined;
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
