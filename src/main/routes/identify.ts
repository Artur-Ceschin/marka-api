import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  confirmDetectionSchema,
  createUploadSchema,
  identifyRequestSchema,
  listDetectionsSchema,
} from "@/applications/schemas/identify";
import { makeIdentifyController } from "@/main/factories/makeIdentifyController";
import { authenticated, requireUser } from "@/main/plugins/authenticated";

export function identifyRoutes(app: FastifyInstance) {
  // Step 1 of the upload flow: hand back a presigned POST the client uses to
  // send the image straight to S3, bypassing Lambda's 6MB payload limit.
  app.post(
    "/uploads",
    { preHandler: authenticated },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = requireUser(request);
      const { contentType } = createUploadSchema.parse(request.body);

      const upload = await makeIdentifyController().createUpload(
        userId,
        contentType,
      );

      reply.status(201).send({ success: true, ...upload });
    },
  );

  // Step 3: the user has picked one of the candidates, so enrichment runs
  // against a species a human confirmed rather than a guess.
  app.post(
    "/detections/:detectionId/confirm",
    { preHandler: authenticated },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = requireUser(request);
      const { detectionId } = request.params as { detectionId: string };
      const { species } = confirmDetectionSchema.parse(request.body);

      const result = await makeIdentifyController().confirm({
        userId,
        detectionId,
        species,
      });

      reply.status(200).send(result);
    },
  );

  app.post(
    "/identify",
    { preHandler: authenticated },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = requireUser(request);
      const { key, location } = identifyRequestSchema.parse(request.body);

      const result = await makeIdentifyController().identify({
        userId,
        key,
        location,
      });

      reply.status(201).send(result);
    },
  );

  app.get(
    "/identifications",
    { preHandler: authenticated },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = requireUser(request);
      const { limit, cursor } = listDetectionsSchema.parse(request.query);

      const result = await makeIdentifyController().listDetections(userId, {
        limit,
        cursor,
      });

      reply.status(200).send({ success: true, ...result });
    },
  );
}
