import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { lazy } from "@/kernel/lazy";
import { env } from "@/shared/env";

export const cognitoClient = lazy(
  () => new CognitoIdentityProviderClient({ region: env.AWS_REGION }),
);
