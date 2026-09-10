import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { AppError } from "@/kernel/errors/AppError";

process.env.USER_POOL_ID = "us-east-1_test";
process.env.USER_POOL_CLIENT_ID = "testclient";

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
        gatewayThatThrows(awsError("CodeMismatchException")).confirmForgotPassword({
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
