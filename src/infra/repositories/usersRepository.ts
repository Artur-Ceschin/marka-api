import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "@/infra/clients/dynamo";
import { isAwsError } from "@/kernel/errors/isAwsError";
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

  async findById(userId: string): Promise<UserProfile | undefined> {
    const { Item } = await dynamoClient().send(
      new GetCommand({ TableName: this.table, Key: { userId } }),
    );

    return Item as UserProfile | undefined;
  }

  // Idempotent: an existing row is left exactly as it is, never overwritten.
  async createIfMissing(profile: UserProfile): Promise<void> {
    await this.create(profile).catch((error: unknown) => {
      if (!isAwsError(error, "ConditionalCheckFailedException")) {
        throw error;
      }
    });
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
