import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GetProfileUseCase } from "@/applications/useCases/auth/GetProfileUseCase";
import { AppError } from "@/kernel/errors/AppError";
import type { UserProfile } from "@/shared/types/auth";

const SUB = "b428a418-2001-70dc-2a7c-ab479eb808fc";

const STORED: UserProfile = {
  userId: SUB,
  email: "artur@example.com",
  name: "Artur",
  emailVerified: true,
  createdAt: "2026-09-10T12:44:21.155Z",
};

// Signing is local, so the fake just records that a key was asked for.
const bucket = {
  imageUrl: async (key: string) => `https://signed.example/${key}`,
};

function makeUsers(stored?: UserProfile) {
  const created: UserProfile[] = [];

  return {
    created,
    findById: async () => stored,
    createIfMissing: async (profile: UserProfile) => {
      created.push(profile);
    },
  };
}

describe("GetProfileUseCase", () => {
  it("returns the stored profile without writing anything", async () => {
    const users = makeUsers(STORED);

    const result = await new GetProfileUseCase(users, bucket).execute({
      sub: SUB,
      email: STORED.email,
    });

    assert.equal(result.userId, SUB);
    assert.equal(result.name, "Artur");
    assert.deepEqual(users.created, []);
  });

  it("rebuilds a missing profile from the verified token claims", async () => {
    const users = makeUsers();

    const result = await new GetProfileUseCase(users, bucket).execute({
      sub: SUB,
      email: "artur@example.com",
    });

    // A failed postConfirmation write must not leave a signed-in user without
    // a profile for good.
    assert.equal(users.created.length, 1);
    assert.equal(result.userId, SUB);
    assert.equal(result.email, "artur@example.com");
  });

  it("is a 404 when there is no row and no email to rebuild one", async () => {
    await assert.rejects(
      () => new GetProfileUseCase(makeUsers(), bucket).execute({ sub: SUB }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });
});
