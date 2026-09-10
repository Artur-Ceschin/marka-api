import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConfirmSignUpUseCase } from "@/applications/useCases/ConfirmSignUpUseCase";

const SUB = "8f2c1e94-0000-4a1b-9c3d-abc123456789";
const INPUT = { email: "artur@example.com", code: "123456" };

function makeCognito(overrides: { confirmSignUp?: () => Promise<void> } = {}) {
  return {
    confirmSignUp: async () => {
      if (overrides.confirmSignUp) await overrides.confirmSignUp();
    },
    findUserId: async () => SUB,
  };
}

function makeUsers() {
  const verified: string[] = [];

  return {
    verified,
    markEmailVerified: async (userId: string) => {
      verified.push(userId);
    },
  };
}

describe("ConfirmSignUpUseCase", () => {
  it("marks the profile verified using the sub looked up from the email", async () => {
    const users = makeUsers();

    await new ConfirmSignUpUseCase(makeCognito(), users).execute(INPUT);

    assert.deepEqual(users.verified, [SUB]);
  });

  it("leaves the profile untouched when the code is rejected", async () => {
    const users = makeUsers();
    const cognito = makeCognito({
      confirmSignUp: async () => {
        throw new Error("CodeMismatchException");
      },
    });

    await assert.rejects(() =>
      new ConfirmSignUpUseCase(cognito, users).execute(INPUT),
    );

    assert.deepEqual(users.verified, []);
  });
});
