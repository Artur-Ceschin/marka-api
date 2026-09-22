import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "@/infra/clients/dynamo";
import { isAwsError } from "@/kernel/errors/isAwsError";
import { requireEnv } from "@/shared/env";
import type { ProfileWrite, UserProfile } from "@/shared/types/auth";

const EDITABLE_FIELDS = [
  "name",
  "bio",
  "avatarKey",
  "homeLocation",
  // Derived from homeLocation by the use case, never taken from the body.
  "homeLocationName",
] as const;

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

  async update(
    userId: string,
    changes: ProfileWrite,
    now = new Date().toISOString(),
  ): Promise<UserProfile | undefined> {
    const names: Record<string, string> = { "#updatedAt": "updatedAt" };
    const values: Record<string, unknown> = { ":updatedAt": now };
    const set = ["#updatedAt = :updatedAt"];
    const remove: string[] = [];

    for (const field of EDITABLE_FIELDS) {
      const value = changes[field];

      if (value === undefined) {
        continue;
      }

      names[`#${field}`] = field;

      if (value === null) {
        remove.push(`#${field}`);
      } else {
        values[`:${field}`] = value;
        set.push(`#${field} = :${field}`);
      }
    }

    const removeClause =
      remove.length > 0 ? ` REMOVE ${remove.join(", ")}` : "";

    try {
      const { Attributes } = await dynamoClient().send(
        new UpdateCommand({
          TableName: this.table,
          Key: { userId },
          UpdateExpression: `SET ${set.join(", ")}${removeClause}`,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ConditionExpression: "attribute_exists(userId)",
          ReturnValues: "ALL_NEW",
        }),
      );

      return Attributes as UserProfile;
    } catch (error) {
      if (isAwsError(error, "ConditionalCheckFailedException")) {
        return undefined;
      }
      throw error;
    }
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
