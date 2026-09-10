import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "@/infra/clients/dynamo";
import { env } from "@/shared/env";
import type { UserProfile } from "@/shared/types/auth";

export class UsersRepository {
  private readonly table: string;

  constructor() {
    if (!env.USERS_TABLE) {
      throw new Error(
        "USERS_TABLE is required for auth routes. In deployed environments " +
          "serverless injects it; locally, copy it from `pnpm sls:print` into .env",
      );
    }

    this.table = env.USERS_TABLE;
  }

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
