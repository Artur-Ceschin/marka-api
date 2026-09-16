import { randomUUID } from "node:crypto";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "@/infra/clients/dynamo";
import { isAwsError } from "@/kernel/errors/isAwsError";
import { requireEnv } from "@/shared/env";
import type {
  Detection,
  DetectionChanges,
  DetectionPage,
} from "@/shared/types/plant";

// The only attributes an update may touch. The loop walks this list, not the
// input, so a stray key can never overwrite userId, status or enrichment.
const EDITABLE_FIELDS = ["notes", "observedAt", "location"] as const;

// A failed condition means "no row matched", which each caller turns into its
// own answer; anything else is a real failure.
function unlessConditionFailed(error: unknown): undefined {
  if (isAwsError(error, "ConditionalCheckFailedException")) {
    return undefined;
  }
  throw error;
}

export class DetectionsRepository {
  private readonly table = requireEnv("DETECTIONS_TABLE");

  // Timestamp first so the sort key orders chronologically; a random suffix
  // keeps two detections in the same millisecond from colliding.
  static newId(at = new Date()): string {
    return `${at.toISOString()}#${randomUUID().slice(0, 8)}`;
  }

  // Conditional on the id being new, so saving the same identification twice
  // cannot overwrite the first detection. False when it already existed.
  async create(detection: Detection): Promise<boolean> {
    try {
      await dynamoClient().send(
        new PutCommand({
          TableName: this.table,
          Item: detection,
          ConditionExpression: "attribute_not_exists(detectionId)",
        }),
      );
      return true;
    } catch (error) {
      unlessConditionFailed(error);
      return false;
    }
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

  async findById(
    userId: string,
    detectionId: string,
  ): Promise<Detection | undefined> {
    const response = await dynamoClient().send(
      new GetCommand({
        TableName: this.table,
        // Both key parts, so a detection can only ever be read by its owner.
        Key: { userId, detectionId },
      }),
    );

    return response.Item as Detection | undefined;
  }

  // SET for values, REMOVE for nulls. Storing a DynamoDB NULL instead would
  // give every reader a third state — present, absent, and present-but-null.
  static updateExpressionFor(changes: DetectionChanges, now: string) {
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

    return {
      UpdateExpression: `SET ${set.join(", ")}${removeClause}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    };
  }

  async update(
    userId: string,
    detectionId: string,
    changes: DetectionChanges,
  ): Promise<Detection | undefined> {
    const response = await dynamoClient()
      .send(
        new UpdateCommand({
          TableName: this.table,
          Key: { userId, detectionId },
          ...DetectionsRepository.updateExpressionFor(
            changes,
            new Date().toISOString(),
          ),
          // Without it, an update on a missing key inserts a half-built row.
          ConditionExpression: "attribute_exists(detectionId)",
          ReturnValues: "ALL_NEW",
        }),
      )
      .catch(unlessConditionFailed);

    return response?.Attributes as Detection | undefined;
  }

  // Returns the deleted row, so the caller can remove its image without a
  // second read. No condition needed: deleting a missing key returns no
  // attributes, which already says there was nothing to delete.
  async delete(
    userId: string,
    detectionId: string,
  ): Promise<Detection | undefined> {
    const response = await dynamoClient().send(
      new DeleteCommand({
        TableName: this.table,
        Key: { userId, detectionId },
        ReturnValues: "ALL_OLD",
      }),
    );

    return response.Attributes as Detection | undefined;
  }
}
