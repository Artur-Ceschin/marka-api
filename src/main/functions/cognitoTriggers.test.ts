import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UserType } from "@aws-sdk/client-cognito-identity-provider";
import { findLinkableAccount } from "@/main/functions/cognitoTriggers";

const account = (status: string, emailVerified: string): UserType => ({
  Username: `${status}-${emailVerified}`,
  UserStatus: status as UserType["UserStatus"],
  Attributes: [{ Name: "email_verified", Value: emailVerified }],
});

describe("findLinkableAccount", () => {
  it("links a Google sign-in to a confirmed, verified password account", () => {
    const confirmed = account("CONFIRMED", "true");

    assert.equal(findLinkableAccount([confirmed]), confirmed);
  });

  it("never links into an unconfirmed account anyone could have created", () => {
    // The pre-account-takeover: an attacker signs up with the victim's address
    // and never confirms, waiting for the victim to arrive through Google.
    assert.equal(
      findLinkableAccount([account("UNCONFIRMED", "false")]),
      undefined,
    );
  });

  it("skips a confirmed account whose own email is not verified", () => {
    assert.equal(
      findLinkableAccount([account("CONFIRMED", "false")]),
      undefined,
    );
  });

  it("ignores another Google user with the same email", () => {
    assert.equal(
      findLinkableAccount([account("EXTERNAL_PROVIDER", "true")]),
      undefined,
    );
  });

  it("finds the linkable account among others", () => {
    const confirmed = account("CONFIRMED", "true");

    assert.equal(
      findLinkableAccount([account("UNCONFIRMED", "false"), confirmed]),
      confirmed,
    );
  });
});
