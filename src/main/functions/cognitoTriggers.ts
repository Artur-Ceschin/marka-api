import {
  AdminLinkProviderForUserCommand,
  ListUsersCommand,
  type UserType,
} from "@aws-sdk/client-cognito-identity-provider";
import { cognitoClient } from "@/infra/clients/cognito";
import { UsersRepository } from "@/infra/repositories/usersRepository";

interface CognitoTriggerEvent {
  triggerSource: string;
  userPoolId: string;
  userName: string;
  request: {
    userAttributes: Record<string, string>;
  };
  response: Record<string, unknown>;
}

export const postConfirmation = async (event: CognitoTriggerEvent) => {
  if (event.triggerSource !== "PostConfirmation_ConfirmSignUp") {
    return event;
  }

  const userId = event.request.userAttributes.sub;
  const email = event.request.userAttributes.email;

  if (!userId || !email) {
    console.error("[postConfirmation] missing sub or email", {
      triggerSource: event.triggerSource,
    });
    return event;
  }

  try {
    await new UsersRepository().createIfMissing({
      userId,
      email,
      name: event.request.userAttributes.name,

      emailVerified: event.request.userAttributes.email_verified === "true",
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[postConfirmation] could not write profile", error);
  }

  return event;
};

export function findLinkableAccount(users: UserType[]): UserType | undefined {
  return users.find(
    (user) =>
      user.UserStatus === "CONFIRMED" &&
      user.Attributes?.some(
        (attribute) =>
          attribute.Name === "email_verified" && attribute.Value === "true",
      ),
  );
}

/**
 * Links a Google sign-in to an existing native account with the same email.
 *
 * Without this, signing up with a password and later clicking "Sign in with
 * Google" creates a SECOND Cognito user with a different `sub` — so a second
 * profile row and a second, separate set of detections, with nothing
 * connecting them. Linking is far cheaper to do now than to reconcile later.
 */
export const preSignUp = async (event: CognitoTriggerEvent) => {
  if (event.triggerSource !== "PreSignUp_ExternalProvider") {
    return event;
  }

  const { email, email_verified } = event.request.userAttributes;

  // Linking lets the external identity sign in AS the existing account, so an
  // unverified email here would be an account takeover: anyone who can make
  // an IdP assert your address would inherit your detections.
  if (!email || email_verified !== "true" || email.includes('"')) {
    return event;
  }

  // userName arrives as "Google_1234567890" for a federated sign-in.
  const [providerName, ...rest] = event.userName.split("_");
  const providerUserId = rest.join("_");

  if (!providerName || !providerUserId) {
    return event;
  }

  try {
    // DestinationUser must be the pool *username*, and with email as the
    // sign-in attribute that username is a UUID, not the address. So the
    // native account has to be found by email first.
    const { Users = [] } = await cognitoClient().send(
      new ListUsersCommand({
        UserPoolId: event.userPoolId,
        Filter: `email = "${email}"`,
        Limit: 10,
      }),
    );

    const native = findLinkableAccount(Users);

    // No password account with this email: a genuinely new Google user, and
    // Cognito should create them normally.
    if (!native?.Username) {
      return event;
    }

    await cognitoClient().send(
      new AdminLinkProviderForUserCommand({
        UserPoolId: event.userPoolId,
        DestinationUser: {
          ProviderName: "Cognito",
          ProviderAttributeValue: native.Username,
        },
        SourceUser: {
          ProviderName: providerName,
          ProviderAttributeName: "Cognito_Subject",
          ProviderAttributeValue: providerUserId,
        },
      }),
    );
  } catch (error) {
    // Never block sign-in over a failed link — the worst case is the
    // duplicate-account problem this trigger exists to prevent, not a lockout.
    console.error("[preSignUp] could not link provider", error);
  }

  return event;
};
