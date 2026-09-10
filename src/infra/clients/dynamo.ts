import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { env } from "@/shared/env";

/**
 * DocumentClient wraps the raw client so we pass plain JS objects instead
 * of DynamoDB's attribute-map format ({ userId: { S: "abc" } }).
 *
 * Built lazily and reused: the client opens a connection pool, and on
 * Lambda a module-level instance survives between warm invocations —
 * creating one per request would pay TLS setup every time.
 */
let client: DynamoDBDocumentClient | undefined;

export function dynamoClient(): DynamoDBDocumentClient {
  client ??= DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: env.AWS_REGION }),
    // Don't write attributes whose value is undefined, instead of throwing.
    { marshallOptions: { removeUndefinedValues: true } },
  );

  return client;
}
