import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UpdateProfileUseCase } from "@/applications/useCases/auth/UpdateProfileUseCase";
import { AppError } from "@/kernel/errors/AppError";
import type { ProfileWrite, UserProfile } from "@/shared/types/auth";
import type { Location } from "@/shared/types/plant";

const SUB = "b428a418-2001-70dc-2a7c-ab479eb808fc";
const OTHER = "99999999-0000-0000-0000-000000000000";

const STORED: UserProfile = {
  userId: SUB,
  email: "artur@example.com",
  emailVerified: true,
  createdAt: "2026-09-10T12:44:21.155Z",
};

function makeUsers(stored: UserProfile | undefined = STORED) {
  const updates: ProfileWrite[] = [];

  return {
    updates,
    findById: async () => stored,
    update: async (_userId: string, changes: ProfileWrite) => {
      updates.push(changes);
      return stored ? { ...stored, ...changes } : undefined;
    },
  } as never as {
    updates: ProfileWrite[];
    findById: () => Promise<UserProfile | undefined>;
    update: (
      userId: string,
      changes: ProfileWrite,
    ) => Promise<UserProfile | undefined>;
  };
}

// Records what it was asked, so the coordinate order and language can be
// asserted without reaching Amazon Location.
function makeGeocoder(name: string | undefined = "Boa Vista, Roraima, Brazil") {
  const asked: { location: Location; locale: string }[] = [];

  return {
    asked,
    describe: async (location: Location, locale: string) => {
      asked.push({ location, locale });
      return name;
    },
  };
}

function makeBucket() {
  const copied: string[] = [];
  const deleted: string[] = [];

  return {
    copied,
    deleted,
    imageUrl: async (key: string) => `https://signed.example/${key}`,
    persist: async (uploadKey: string, key: string) => {
      copied.push(`${uploadKey} -> ${key}`);
      return key;
    },
    deleteObject: async (key: string) => {
      deleted.push(key);
    },
  };
}

describe("UpdateProfileUseCase", () => {
  it("edits text fields with a single write and no read", async () => {
    const users = makeUsers();
    const bucket = makeBucket();

    const result = await new UpdateProfileUseCase(
      users,
      bucket,
      makeGeocoder(),
    ).execute(SUB, {
      name: "Artur",
      bio: "Grows too many monsteras",
    });

    assert.equal(result.name, "Artur");
    // The avatar is untouched, so nothing was read and nothing was copied.
    assert.deepEqual(bucket.copied, []);
    assert.deepEqual(bucket.deleted, []);
  });

  it("promotes a new avatar out of the expiring uploads/ prefix", async () => {
    const users = makeUsers();
    const bucket = makeBucket();

    const result = await new UpdateProfileUseCase(
      users,
      bucket,
      makeGeocoder(),
    ).execute(SUB, {
      avatarKey: `uploads/${SUB}/abc`,
    });

    assert.deepEqual(bucket.copied, [
      `uploads/${SUB}/abc -> avatars/${SUB}/abc`,
    ]);
    // The stored key never reaches the client; a signed URL does.
    assert.equal(result.avatarUrl, `https://signed.example/avatars/${SUB}/abc`);
    assert.ok(!("avatarKey" in result));
  });

  it("refuses another user's upload key before touching S3", async () => {
    const users = makeUsers();
    const bucket = makeBucket();

    await assert.rejects(
      () =>
        new UpdateProfileUseCase(users, bucket, makeGeocoder()).execute(SUB, {
          avatarKey: `uploads/${OTHER}/abc`,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        // 404, not 403: confirming the key exists but belongs to someone else
        // is itself a leak.
        assert.equal(error.statusCode, 404);
        return true;
      },
    );

    assert.deepEqual(bucket.copied, []);
    assert.deepEqual(users.updates, []);
  });

  it("deletes the photo it replaced, after the row is written", async () => {
    const users = makeUsers({ ...STORED, avatarKey: `avatars/${SUB}/old` });
    const bucket = makeBucket();

    await new UpdateProfileUseCase(users, bucket, makeGeocoder()).execute(SUB, {
      avatarKey: `uploads/${SUB}/new`,
    });

    assert.deepEqual(bucket.deleted, [`avatars/${SUB}/old`]);
  });

  it("deletes the old photo when the avatar is cleared", async () => {
    const users = makeUsers({ ...STORED, avatarKey: `avatars/${SUB}/old` });
    const bucket = makeBucket();

    const result = await new UpdateProfileUseCase(
      users,
      bucket,
      makeGeocoder(),
    ).execute(SUB, {
      avatarKey: null,
    });

    assert.equal(result.avatarUrl, undefined);
    assert.deepEqual(bucket.deleted, [`avatars/${SUB}/old`]);
  });

  it("still succeeds when the replaced photo cannot be deleted", async () => {
    const users = makeUsers({ ...STORED, avatarKey: `avatars/${SUB}/old` });
    const bucket = {
      ...makeBucket(),
      deleteObject: async () => {
        throw new Error("S3 is having a day");
      },
    };

    // The edit the user asked for was already saved; an orphaned object is the
    // lesser failure and must not turn into a 500.
    const result = await new UpdateProfileUseCase(
      users,
      bucket,
      makeGeocoder(),
    ).execute(SUB, {
      avatarKey: `uploads/${SUB}/new`,
    });

    assert.equal(result.avatarUrl, `https://signed.example/avatars/${SUB}/new`);
  });

  it("resolves and stores a place name for a new home location", async () => {
    const users = makeUsers();
    const geocoder = makeGeocoder();

    const result = await new UpdateProfileUseCase(
      users,
      makeBucket(),
      geocoder,
    ).execute(
      SUB,
      { homeLocation: { latitude: 3.37, longitude: -59.83 } },
      "pt-BR",
    );

    assert.equal(result.homeLocationName, "Boa Vista, Roraima, Brazil");
    // Geocoded in the request's language, from the coordinates actually stored.
    assert.deepEqual(geocoder.asked, [
      { location: { latitude: 3.37, longitude: -59.83 }, locale: "pt-BR" },
    ]);
  });

  it("does not geocode an edit that leaves the home location alone", async () => {
    const geocoder = makeGeocoder();

    await new UpdateProfileUseCase(makeUsers(), makeBucket(), geocoder).execute(
      SUB,
      { bio: "New bio" },
    );

    // Otherwise every bio edit would pay for a lookup and could overwrite a
    // good name with a failed one.
    assert.deepEqual(geocoder.asked, []);
  });

  it("clears the name when the home location is cleared", async () => {
    const users = makeUsers({
      ...STORED,
      homeLocation: { latitude: 3.37, longitude: -59.83 },
      homeLocationName: "Boa Vista, Roraima, Brazil",
    });

    await new UpdateProfileUseCase(users, makeBucket(), makeGeocoder()).execute(
      SUB,
      { homeLocation: null },
    );

    assert.equal(users.updates[0]?.homeLocationName, null);
  });

  it("saves the location even when the lookup returns nothing", async () => {
    const users = makeUsers();

    // Inline, not makeGeocoder(undefined): a default parameter fires on
    // `undefined` and would hand back the usual name instead of nothing.
    const silent = { describe: async () => undefined };

    const result = await new UpdateProfileUseCase(
      users,
      makeBucket(),
      silent,
    ).execute(SUB, { homeLocation: { latitude: 3.37, longitude: -59.83 } });

    // Losing the label must not lose the user's edit.
    assert.deepEqual(result.homeLocation, {
      latitude: 3.37,
      longitude: -59.83,
    });
    assert.equal(result.homeLocationName, null);
  });

  it("is a 404, not a 500, when the upload never happened", async () => {
    const bucket = {
      ...makeBucket(),
      persist: async () => {
        // What S3 throws when CopyObject's source key has no object.
        throw Object.assign(new Error("NoSuchKey"), { name: "NoSuchKey" });
      },
    };

    await assert.rejects(
      () =>
        new UpdateProfileUseCase(makeUsers(), bucket, makeGeocoder()).execute(
          SUB,
          { avatarKey: `uploads/${SUB}/never-uploaded` },
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  it("is a 404 when no profile row exists", async () => {
    // Built inline rather than with makeUsers(undefined): a JS default
    // parameter fires on `undefined`, so that call would hand back STORED and
    // quietly assert nothing.
    const users = {
      findById: async () => undefined,
      // What the repository returns when attribute_exists(userId) fails.
      update: async () => undefined,
    };

    await assert.rejects(
      () =>
        new UpdateProfileUseCase(users, makeBucket(), makeGeocoder()).execute(
          SUB,
          {
            name: "Artur",
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });
});
