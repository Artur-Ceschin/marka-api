import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "@/infra/clients/dynamo";
import { AppError } from "@/kernel/errors/AppError";
import { isAwsError } from "@/kernel/errors/isAwsError";
import { env, requireEnv } from "@/shared/env";

const SECONDS_PER_DAY = 86_400;

export interface QuotaResult {
  used: number;
  limit: number;
  remaining: number;
}

export class UsageRepository {
  private readonly table = requireEnv("USAGE_TABLE");

  // UTC, so the reset time is the same for everyone rather than depending on
  // where the caller happens to be.
  static today(at = new Date()): string {
    return at.toISOString().slice(0, 10);
  }

  /**
   * Claims one identification against today's quota, atomically.
   *
   * The whole check is a single conditional UpdateItem — deliberately not a
   * read followed by a write. Two concurrent requests would both read 4,
   * both decide there was room, and both proceed; DynamoDB evaluates the
   * condition and the increment together, so the second one fails instead.
   *
   * The credit is claimed *before* PlantNet is called, which means a failed
   * identification still costs the user one. That is the right way round: the
   * point of the quota is protecting a shared 500/day allowance, and a
   * check-after-success design lets a burst of retries blow through it.
   */
  async claimIdentification(userId: string): Promise<QuotaResult> {
    const limit = env.DAILY_IDENTIFY_LIMIT;
    const day = UsageRepository.today();

    try {
      const response = await dynamoClient().send(
        new UpdateCommand({
          TableName: this.table,
          Key: { userId, day },
          // ADD creates the attribute at :one when the row is new, so the
          // first call of the day needs no special case.
          UpdateExpression: "ADD #count :one SET #expiresAt = :expiresAt",
          ConditionExpression:
            "attribute_not_exists(#count) OR #count < :limit",
          ExpressionAttributeNames: {
            "#count": "count",
            "#expiresAt": "expiresAt",
          },
          ExpressionAttributeValues: {
            ":one": 1,
            ":limit": limit,
            // Two days out, so a row cannot expire while the day it counts
            // is still in progress anywhere.
            ":expiresAt": Math.floor(Date.now() / 1000) + SECONDS_PER_DAY * 2,
          },
          ReturnValues: "ALL_NEW",
        }),
      );

      const used = Number(response.Attributes?.count ?? 0);

      return { used, limit, remaining: Math.max(0, limit - used) };
    } catch (error) {
      // The condition failing is the quota being spent — the only expected
      // failure here, and not a server error.
      if (isAwsError(error, "ConditionalCheckFailedException")) {
        throw new AppError(
          429,
          "DAILY_LIMIT_REACHED",
          `You have used all ${limit} identifications for today. The limit resets at midnight UTC`,
        );
      }

      throw error;
    }
  }
}
