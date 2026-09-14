import { randomUUID } from "node:crypto";
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "@/infra/clients/dynamo";
import { requireEnv } from "@/shared/env";
import type {
  Detection,
  DetectionPage,
  PlantEnrichment,
} from "@/shared/types/plant";

export class DetectionsRepository {
  private readonly table = requireEnv("DETECTIONS_TABLE");

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

  async confirm({
    userId,
    detectionId,
    species,
    enrichment,
  }: {
    userId: string;
    detectionId: string;
    species: string;
    enrichment: PlantEnrichment;
  }): Promise<Detection> {
    const response = await dynamoClient().send(
      new UpdateCommand({
        TableName: this.table,
        Key: { userId, detectionId },
        UpdateExpression:
          "SET #status = :status, #species = :species, " +
          "#enrichment = :enrichment, #confirmedAt = :now",
        // Aliased throughout: `status` is a DynamoDB reserved word, and
        // aliasing the rest keeps the habit consistent.
        ExpressionAttributeNames: {
          "#status": "status",
          "#species": "confirmedSpecies",
          "#enrichment": "enrichment",
          "#confirmedAt": "confirmedAt",
        },
        // Never create a row here: an Update on a missing key would otherwise
        // insert one, inventing a detection that was never identified.
        ConditionExpression:
          "attribute_exists(detectionId) AND #status = :pending",
        ExpressionAttributeValues: {
          ":status": "confirmed",
          ":pending": "pending_confirmation",
          ":species": species,
          ":enrichment": enrichment,
          ":now": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      }),
    );

    return response.Attributes as Detection;
  }
}
