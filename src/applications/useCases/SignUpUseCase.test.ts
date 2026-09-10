import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { SignUpUseCase } from "@/applications/useCases/SignUpUseCase";
import { UserProfile } from "@/shared/types/auth";

const SUB = "8f2c1e94-0000-4a1b-9c3d-abc123456789";
const INPUT = { email: "artur@example.com", password: "Supersecret1" };

/**
 * Fakes rather than mocks: they record what happened so the test can assert
 * on the *result*, not on how many times a spy was called.
 */
function makeCognito(overrides: { signUp?: () => Promise<string> } = {}) {
  const calls: string[] = [];

  return {
    calls,
    signUp: overrides.signUp
      ? async (input: typeof INPUT) => {
          calls.push(input.email);
          return overrides.signUp!();
        }
      : async (input: typeof INPUT) => {
          calls.push(input.email);
          return SUB;
        },
  };
}

function makeUsers(overrides: { create?: () => Promise<void> } = {}) {
  const created: UserProfile[] = [];

  return {
    created,
    create: async (profile: UserProfile) => {
      created.push(profile);
      if (overrides.create) await overrides.create();
    },
  };
}

describe("SignUpUseCase", () => {
  let cognito: ReturnType<typeof makeCognito>;
  let users: ReturnType<typeof makeUsers>;

  beforeEach(() => {
    cognito = makeCognito();
    users = makeUsers();
  });

  it("keys the profile row on the sub Cognito returns, not the email", async () => {
    await new SignUpUseCase(cognito, users).execute(INPUT);

    assert.equal(users.created.length, 1);
    assert.equal(users.created[0]?.userId, SUB);
    assert.equal(users.created[0]?.email, INPUT.email);
  });

  it("creates the profile unverified — /auth/confirm is what flips it", async () => {
    await new SignUpUseCase(cognito, users).execute(INPUT);

    assert.equal(users.created[0]?.emailVerified, false);
    assert.ok(users.created[0]?.createdAt, "createdAt should be stamped");
  });

  it("returns the userId and a message pointing at the emailed code", async () => {
    const result = await new SignUpUseCase(cognito, users).execute(INPUT);

    assert.equal(result.success, true);
    assert.equal(result.userId, SUB);
    assert.match(result.message, /confirmation code/i);
  });

  it("writes no profile when Cognito rejects the sign-up", async () => {
    const failing = makeCognito({
      signUp: async () => {
        throw new Error("UsernameExistsException");
      },
    });

    await assert.rejects(() => new SignUpUseCase(failing, users).execute(INPUT));

    // The ordering guarantee: Cognito owns the uniqueness check, so a
    // rejected sign-up must never leave an orphaned profile row behind.
    assert.equal(users.created.length, 0);
  });

  it("propagates a failed profile write instead of reporting success", async () => {
    const failing = makeUsers({
      create: async () => {
        throw new Error("ConditionalCheckFailedException");
      },
    });

    await assert.rejects(() =>
      new SignUpUseCase(cognito, failing).execute(INPUT),
    );

    // Documents the known gap: there is no transaction across Cognito and
    // DynamoDB, so the Cognito user survives this failure and a retry gets
    // a 409. If that ever bites, the fix is a PostConfirmation trigger.
    assert.deepEqual(cognito.calls, [INPUT.email]);
  });
});
