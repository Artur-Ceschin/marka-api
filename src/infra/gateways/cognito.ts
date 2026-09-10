import {
  AdminGetUserCommand,
  AdminInitiateAuthCommand,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ResendConfirmationCodeCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { AppError } from "@/kernel/errors/AppError";
import { env } from "@/shared/env";
import type {
  AuthTokens,
  ConfirmSignUpRequest,
  ForgotPasswordRequest,
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
  private readonly client: CognitoIdentityProviderClient;
  private readonly userPoolId: string;
  private readonly clientId: string;

  constructor(client?: CognitoIdentityProviderClient) {
    if (!env.USER_POOL_ID || !env.USER_POOL_CLIENT_ID) {
      throw new Error(
        "USER_POOL_ID and USER_POOL_CLIENT_ID are required for auth routes. " +
          "In deployed environments serverless injects them; locally, copy " +
          "them from `pnpm sls:print` into .env",
      );
    }

    this.client =
      client ?? new CognitoIdentityProviderClient({ region: env.AWS_REGION });
    this.userPoolId = env.USER_POOL_ID;
    this.clientId = env.USER_POOL_CLIENT_ID;
  }

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
      if (error instanceof Error && error.name === "UserNotFoundException") {
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
      if (error instanceof Error && error.name === "UserNotFoundException") {
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
      if (error instanceof Error && error.name === "NotAuthorizedException") {
        throw new AppError(
          401,
          "SESSION_EXPIRED",
          "Your session has expired. Sign in again",
        );
      }

      throw this.toAppError(error);
    }
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
