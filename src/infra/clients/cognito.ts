import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { env } from "@/shared/env";

let client: CognitoIdentityProviderClient | undefined;

export function cognitoClient(): CognitoIdentityProviderClient {
  client ??= new CognitoIdentityProviderClient({ region: env.AWS_REGION });
  return client;
}
