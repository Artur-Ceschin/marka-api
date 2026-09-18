import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { AppError } from "@/kernel/errors/AppError";

process.env.USER_POOL_ID = "us-east-1_test";
process.env.USER_POOL_CLIENT_ID = "testclient";
process.env.COGNITO_DOMAIN = "marka-auth-test.auth.us-east-1.amazoncognito.com";

const { CognitoGateway } = await import("@/infra/gateways/cognito");

function awsError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

function gatewayThatThrows(error?: Error) {
  const fake = {
    send: async () => {
      if (error) throw error;
      return {};
    },
  };

  return new CognitoGateway(fake as unknown as CognitoIdentityProviderClient);
}

function gatewayThatReturns(response: unknown) {
  const fake = { send: async () => response };

  return new CognitoGateway(fake as unknown as CognitoIdentityProviderClient);
}

describe("CognitoGateway.forgotPassword", () => {
  it("resolves when the email has no account", async () => {
    await gatewayThatThrows(awsError("UserNotFoundException")).forgotPassword({
      email: "nobody@example.com",
    });
  });

  it("still surfaces other failures rather than swallowing everything", async () => {
    await assert.rejects(
      () =>
        gatewayThatThrows(awsError("TooManyRequestsException")).forgotPassword({
          email: "artur@example.com",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 429);
        return true;
      },
    );
  });
});

describe("CognitoGateway error mapping", () => {
  it("turns a wrong reset code into a 400, not a 500", async () => {
    await assert.rejects(
      () =>
        gatewayThatThrows(
          awsError("CodeMismatchException"),
        ).confirmForgotPassword({
          email: "artur@example.com",
          code: "123456",
          password: "Supersecret1",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, "INVALID_CODE");
        return true;
      },
    );
  });

  it("leaves an unrecognised error alone so it becomes a 500", async () => {
    const boom = awsError("SomethingNobodyMapped");

    await assert.rejects(
      () =>
        gatewayThatThrows(boom).confirmForgotPassword({
          email: "artur@example.com",
          code: "123456",
          password: "Supersecret1",
        }),
      (error: unknown) => {
        assert.equal(error, boom);
        assert.ok(!(error instanceof AppError));
        return true;
      },
    );
  });
});

describe("CognitoGateway.resendConfirmationCode", () => {
  it("resolves when the email has no account", async () => {
    await gatewayThatThrows(
      awsError("UserNotFoundException"),
    ).resendConfirmationCode({ email: "nobody@example.com" });
  });

  it("surfaces rate limiting rather than swallowing it", async () => {
    await assert.rejects(
      () =>
        gatewayThatThrows(
          awsError("LimitExceededException"),
        ).resendConfirmationCode({ email: "artur@example.com" }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 429);
        return true;
      },
    );
  });
});

describe("CognitoGateway.exchangeAuthorizationCode", () => {
  const request = {
    code: "authorization-code",
    codeVerifier: "v".repeat(43),
    redirectUri: "https://markaplant.app/auth/callback",
  };

  async function withTokenEndpoint<T>(
    respond: () => Response,
    run: (sent: { url: string; body: string }) => Promise<T>,
  ): Promise<T> {
    const original = globalThis.fetch;
    const sent = { url: "", body: "" };
    globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
      sent.url = String(url);
      sent.body = String(init?.body);
      return respond();
    }) as typeof fetch;

    try {
      return await run(sent);
    } finally {
      globalThis.fetch = original;
    }
  }

  it("returns Cognito's tokens, refresh token included, for the cookie", async () => {
    await withTokenEndpoint(
      () =>
        Response.json({
          id_token: "id",
          access_token: "access",
          refresh_token: "refresh",
          expires_in: 3600,
        }),
      async (sent) => {
        const tokens = await gatewayThatReturns({}).exchangeAuthorizationCode(
          request,
        );

        assert.equal(tokens.refreshToken, "refresh");
        assert.equal(
          sent.url,
          "https://marka-auth-test.auth.us-east-1.amazoncognito.com/oauth2/token",
        );
        // PKCE: the verifier is what proves this caller started the flow.
        assert.match(sent.body, /code_verifier=v{43}/);
        assert.match(sent.body, /grant_type=authorization_code/);
      },
    );
  });

  it("turns a spent or expired code into a 400 the client can act on", async () => {
    await withTokenEndpoint(
      () => Response.json({ error: "invalid_grant" }, { status: 400 }),
      async () => {
        await assert.rejects(
          () => gatewayThatReturns({}).exchangeAuthorizationCode(request),
          (error: unknown) =>
            error instanceof AppError &&
            error.code === "INVALID_AUTHORIZATION_CODE",
        );
      },
    );
  });
});

describe("CognitoGateway.revokeRefreshToken", () => {
  it("treats a token Cognito already rejects as signed out", async () => {
    await gatewayThatThrows(
      awsError("UnauthorizedException"),
    ).revokeRefreshToken("already-revoked");
  });

  it("rejects an access or id token with a 400", async () => {
    await assert.rejects(
      () =>
        gatewayThatThrows(
          awsError("UnsupportedTokenTypeException"),
        ).revokeRefreshToken("an-access-token"),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, "INVALID_REFRESH_TOKEN");
        return true;
      },
    );
  });

  it("surfaces revocation being disabled instead of claiming success", async () => {
    // Swallowing this would tell the user they signed out while their refresh
    // token kept working for 30 days.
    const disabled = awsError("UnsupportedOperationException");

    await assert.rejects(
      () => gatewayThatThrows(disabled).revokeRefreshToken("valid-refresh"),
      (error: unknown) => error === disabled,
    );
  });
});

describe("CognitoGateway.refresh", () => {
  it("returns new access and id tokens", async () => {
    const tokens = await gatewayThatReturns({
      AuthenticationResult: {
        AccessToken: "new-access",
        IdToken: "new-id",
        ExpiresIn: 3600,
      },
    }).refresh({ refreshToken: "valid-refresh" });

    assert.deepEqual(tokens, {
      accessToken: "new-access",
      idToken: "new-id",
      expiresIn: 3600,
    });
  });

  it("reports an expired refresh token as SESSION_EXPIRED, not bad credentials", async () => {
    await assert.rejects(
      () =>
        gatewayThatThrows(awsError("NotAuthorizedException")).refresh({
          refreshToken: "expired",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 401);
        assert.equal(error.code, "SESSION_EXPIRED");
        return true;
      },
    );
  });
});
