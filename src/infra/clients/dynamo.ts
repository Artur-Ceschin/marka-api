import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { env } from "@/shared/env";

let client: DynamoDBDocumentClient | undefined;

export function dynamoClient(): DynamoDBDocumentClient {
  client ??= DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: env.AWS_REGION }),
    { marshallOptions: { removeUndefinedValues: true } },
  );

  return client;
}
