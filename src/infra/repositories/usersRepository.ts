import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "@/infra/clients/dynamo";
import { requireEnv } from "@/shared/env";
import type { UserProfile } from "@/shared/types/auth";

export class UsersRepository {
  private readonly table = requireEnv("USERS_TABLE");

  async create(profile: UserProfile): Promise<void> {
    await dynamoClient().send(
      new PutCommand({
        TableName: this.table,
        Item: profile,
        ConditionExpression: "attribute_not_exists(userId)",
      }),
    );
  }

  async markEmailVerified(userId: string): Promise<void> {
    await dynamoClient().send(
      new UpdateCommand({
        TableName: this.table,
        Key: { userId },
        UpdateExpression: "SET #verified = :verified, #confirmedAt = :now",
        ExpressionAttributeNames: {
          "#verified": "emailVerified",
          "#confirmedAt": "confirmedAt",
        },
        ExpressionAttributeValues: {
          ":verified": true,
          ":now": new Date().toISOString(),
        },
      }),
    );
  }
}
