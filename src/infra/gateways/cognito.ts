import {
  AdminGetUserCommand,
  AdminInitiateAuthCommand,
  type CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ResendConfirmationCodeCommand,
  RevokeTokenCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { cognitoClient } from "@/infra/clients/cognito";
import { AppError } from "@/kernel/errors/AppError";
import { isAwsError } from "@/kernel/errors/isAwsError";
import { requireEnv } from "@/shared/env";
import type {
  AuthTokens,
  ConfirmSignUpRequest,
  ForgotPasswordRequest,
  GoogleSignInRequest,
  RefreshRequest,
  RefreshResponse,
  ResendCodeRequest,
  ResetPasswordRequest,
  SignInRequest,
  SignUpRequest,
} from "@/shared/types/auth";

const ERROR_MAP: Record<
  string,
  { status: number; code: string; message: string }
> = {
  UsernameExistsException: {
    status: 409,
    code: "EMAIL_ALREADY_REGISTERED",
    message: "An account with this email already exists",
  },
  InvalidPasswordException: {
    status: 400,
    code: "INVALID_PASSWORD",
    message: "Password does not meet the requirements",
  },
  CodeMismatchException: {
    status: 400,
    code: "INVALID_CODE",
    message: "That confirmation code is not correct",
  },
  ExpiredCodeException: {
    status: 400,
    code: "EXPIRED_CODE",
    message: "That confirmation code has expired. Request a new one",
  },
  UserNotConfirmedException: {
    status: 403,
    code: "USER_NOT_CONFIRMED",
    message: "Confirm your email before signing in",
  },

  NotAuthorizedException: {
    status: 401,
    code: "INVALID_CREDENTIALS",
    message: "Invalid email or password",
  },
  UserNotFoundException: {
    status: 401,
    code: "INVALID_CREDENTIALS",
    message: "Invalid email or password",
  },

  InvalidParameterException: {
    status: 400,
    code: "CANNOT_RESET_PASSWORD",
    message: "Unable to start a password reset for this account",
  },
  TooManyRequestsException: {
    status: 429,
    code: "TOO_MANY_REQUESTS",
    message: "Too many attempts. Try again shortly",
  },
  LimitExceededException: {
    status: 429,
    code: "TOO_MANY_REQUESTS",
    message: "Too many attempts. Try again shortly",
  },
};

export class CognitoGateway {
  private readonly userPoolId = requireEnv("USER_POOL_ID");
  private readonly clientId = requireEnv("USER_POOL_CLIENT_ID");

  // Injectable so tests can drive the error-mapping branches without AWS.
  constructor(
    private readonly client: CognitoIdentityProviderClient = cognitoClient(),
  ) {}

  async signUp({ email, password }: SignUpRequest): Promise<string> {
    const response = await this.mapErrors(() =>
      this.client.send(
        new SignUpCommand({
          ClientId: this.clientId,
          Username: email,
          Password: password,
          UserAttributes: [{ Name: "email", Value: email }],
        }),
      ),
    );

    if (!response.UserSub) {
      throw new Error("Cognito returned no UserSub for a successful sign-up");
    }

    return response.UserSub;
  }

  async confirmSignUp({ email, code }: ConfirmSignUpRequest): Promise<void> {
    await this.mapErrors(() =>
      this.client.send(
        new ConfirmSignUpCommand({
          ClientId: this.clientId,
          Username: email,
          ConfirmationCode: code,
        }),
      ),
    );
  }

  async findUserId(email: string): Promise<string> {
    const response = await this.mapErrors(() =>
      this.client.send(
        new AdminGetUserCommand({
          UserPoolId: this.userPoolId,
          Username: email,
        }),
      ),
    );

    const sub = response.UserAttributes?.find(
      (attribute) => attribute.Name === "sub",
    )?.Value;

    if (!sub) {
      throw new Error(`Cognito user ${email} has no sub attribute`);
    }

    return sub;
  }
  async forgotPassword({ email }: ForgotPasswordRequest): Promise<void> {
    try {
      await this.client.send(
        new ForgotPasswordCommand({
          ClientId: this.clientId,
          Username: email,
        }),
      );
    } catch (error) {
      // Resolve for unknown emails on purpose: differing responses here would
      // let anyone test which addresses have accounts.
      if (isAwsError(error, "UserNotFoundException")) {
        return;
      }

      throw this.toAppError(error);
    }
  }

  async confirmForgotPassword({
    email,
    code,
    password,
  }: ResetPasswordRequest): Promise<void> {
    await this.mapErrors(() =>
      this.client.send(
        new ConfirmForgotPasswordCommand({
          ClientId: this.clientId,
          Username: email,
          ConfirmationCode: code,
          Password: password,
        }),
      ),
    );
  }

  async signIn({ email, password }: SignInRequest): Promise<AuthTokens> {
    const response = await this.mapErrors(() =>
      this.client.send(
        new AdminInitiateAuthCommand({
          UserPoolId: this.userPoolId,
          ClientId: this.clientId,
          // Admin flow is IAM-signed, so the client id alone cannot trade a
          // password for tokens. The pool client does not allow the plain flow.
          AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
          AuthParameters: { USERNAME: email, PASSWORD: password },
        }),
      ),
    );

    const result = response.AuthenticationResult;

    if (!result?.AccessToken || !result.IdToken || !result.RefreshToken) {
      throw new Error(
        `Cognito returned no tokens (challenge: ${response.ChallengeName ?? "none"})`,
      );
    }

    return {
      accessToken: result.AccessToken,
      idToken: result.IdToken,
      refreshToken: result.RefreshToken,
      expiresIn: result.ExpiresIn ?? 3600,
    };
  }

  async resendConfirmationCode({ email }: ResendCodeRequest): Promise<void> {
    try {
      await this.client.send(
        new ResendConfirmationCodeCommand({
          ClientId: this.clientId,
          Username: email,
        }),
      );
    } catch (error) {
      // Same reasoning as forgotPassword: resolve for unknown emails so the
      // endpoint cannot be used to test which addresses have accounts.
      if (isAwsError(error, "UserNotFoundException")) {
        return;
      }

      throw this.toAppError(error);
    }
  }

  async refresh({
    refreshToken,
  }: RefreshRequest): Promise<Omit<RefreshResponse, "success">> {
    try {
      const response = await this.client.send(
        new AdminInitiateAuthCommand({
          UserPoolId: this.userPoolId,
          ClientId: this.clientId,
          AuthFlow: "REFRESH_TOKEN_AUTH",
          AuthParameters: { REFRESH_TOKEN: refreshToken },
        }),
      );

      const result = response.AuthenticationResult;

      // Cognito does not rotate the refresh token, so none comes back here.
      if (!result?.AccessToken || !result.IdToken) {
        throw new Error("Cognito returned no tokens for a refresh");
      }

      return {
        accessToken: result.AccessToken,
        idToken: result.IdToken,
        expiresIn: result.ExpiresIn ?? 3600,
      };
    } catch (error) {
      // NotAuthorizedException here means the refresh token is expired or
      // revoked — not a bad password. The shared map's wording would send the
      // client to the wrong recovery path.
      if (isAwsError(error, "NotAuthorizedException")) {
        throw new AppError(
          401,
          "SESSION_EXPIRED",
          "Your session has expired. Sign in again",
        );
      }

      throw this.toAppError(error);
    }
  }

  /**
   * Revokes the refresh token and the tokens issued from it.
   *
   * A token Cognito already rejects counts as signed out, so signing out twice
   * is not an error. Revocation being disabled on the client IS one: swallowing
   * it would report a sign-out while the refresh token kept working.
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    try {
      await this.client.send(
        new RevokeTokenCommand({
          ClientId: this.clientId,
          Token: refreshToken,
        }),
      );
    } catch (error) {
      if (isAwsError(error, "UnauthorizedException")) {
        return;
      }

      if (
        isAwsError(error, "UnsupportedTokenTypeException") ||
        isAwsError(error, "InvalidParameterException")
      ) {
        throw new AppError(
          400,
          "INVALID_REFRESH_TOKEN",
          "Sign out needs the refresh token, not an access or id token",
        );
      }

      throw this.toAppError(error);
    }
  }

  /**
   * Trades a Google sign-in's authorization code for tokens.
   *
   * The browser used to call Cognito's token endpoint itself, which put the
   * refresh token in JavaScript. Exchanging here is what lets that token go
   * straight into an httpOnly cookie instead. PKCE still protects the code:
   * the verifier never left the browser until now, and a code is single-use.
   *
   * Read lazily, like the pool ids, so routes that never exchange a code work
   * without COGNITO_DOMAIN set.
   */
  async exchangeAuthorizationCode({
    code,
    codeVerifier,
    redirectUri,
  }: GoogleSignInRequest): Promise<AuthTokens> {
    const response = await fetch(
      `https://${requireEnv("COGNITO_DOMAIN")}/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: this.clientId,
          code,
          code_verifier: codeVerifier,
          // Must match the authorize request exactly, or Cognito refuses.
          redirect_uri: redirectUri,
        }),
      },
    );

    // invalid_grant and friends: a code that expired, was used already, or
    // does not match its verifier. The user can only start over.
    if (response.status === 400) {
      throw new AppError(
        400,
        "INVALID_AUTHORIZATION_CODE",
        "That sign-in has expired. Try signing in with Google again",
      );
    }

    if (!response.ok) {
      throw new Error(`Cognito token endpoint answered ${response.status}`);
    }

    const tokens = (await response.json()) as {
      id_token?: string;
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!tokens.id_token || !tokens.access_token || !tokens.refresh_token) {
      throw new Error("Cognito returned no tokens for the authorization code");
    }

    return {
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in ?? 3600,
    };
  }

  private async mapErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw this.toAppError(error);
    }
  }

  private toAppError(error: unknown): unknown {
    const name = error instanceof Error ? error.name : "";
    const mapped = ERROR_MAP[name];

    return mapped
      ? new AppError(mapped.status, mapped.code, mapped.message)
      : error;
  }
}
