import { randomUUID } from "node:crypto";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "@/infra/clients/dynamo";
import { env } from "@/shared/env";
import type { Detection, DetectionPage } from "@/shared/types/plant";

export class DetectionsRepository {
  private readonly table: string;

  constructor() {
    if (!env.DETECTIONS_TABLE) {
      throw new Error(
        "DETECTIONS_TABLE is required. In deployed environments serverless " +
          "injects it; locally, copy it from `pnpm sls:print` into .env",
      );
    }

    this.table = env.DETECTIONS_TABLE;
  }

  // Timestamp first so the sort key orders chronologically; a random suffix
  // keeps two detections in the same millisecond from colliding.
  static newId(at = new Date()): string {
    return `${at.toISOString()}#${randomUUID().slice(0, 8)}`;
  }

  async save(detection: Detection): Promise<void> {
    await dynamoClient().send(
      new PutCommand({ TableName: this.table, Item: detection }),
    );
  }

  // Scoped to one partition key, so this cannot return another user's rows
  // even if the caller passes a bad cursor.
  async listByUser(
    userId: string,
    {
      limit = 20,
      cursor,
    }: { limit?: number; cursor?: string | undefined } = {},
  ): Promise<DetectionPage> {
    const response = await dynamoClient().send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": userId },
        // Newest first: the sort key is timestamp-prefixed, so reading the
        // partition backwards is already chronological order reversed.
        ScanIndexForward: false,
        Limit: limit,
        ...(cursor
          ? { ExclusiveStartKey: { userId, detectionId: cursor } }
          : {}),
      }),
    );

    return {
      items: (response.Items ?? []) as Detection[],
      nextCursor: response.LastEvaluatedKey?.detectionId as string | undefined,
    };
  }
}
