import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  confirmDetectionSchema,
  createUploadSchema,
  identifyRequestSchema,
  listDetectionsSchema,
  updateDetectionSchema,
} from "@/applications/schemas/identify";
import { makeIdentifyController } from "@/main/factories/makeIdentifyController";
import { authenticated, requireUser } from "@/main/plugins/authenticated";
import { localeFrom } from "@/shared/locale";

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

  // Step 3: the user has picked one of the candidates. This is the only
  // request that stores anything — enrichment, the image copy and the row.
  app.post(
    "/detections",
    { preHandler: authenticated },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = requireUser(request);
      const { identificationToken, species } = confirmDetectionSchema.parse(
        request.body,
      );

      const result = await makeIdentifyController().confirm({
        userId,
        identificationToken,
        species,
        // Care text is written, and stored, in the app's language.
        locale: localeFrom(request.headers["accept-language"]),
      });

      reply.status(201).send(result);
    },
  );

  app.post(
    "/identify",
    { preHandler: authenticated },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = requireUser(request);
      const { key, location, observedAt } = identifyRequestSchema.parse(
        request.body,
      );

      const result = await makeIdentifyController().identify({
        userId,
        key,
        location,
        observedAt,
        // Common names come back in the app's language.
        locale: localeFrom(request.headers["accept-language"]),
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

  app.get(
    "/detections/:detectionId",
    { preHandler: authenticated },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = requireUser(request);
      const { detectionId } = request.params as { detectionId: string };

      const detection = await makeIdentifyController().getDetection({
        userId,
        detectionId,
      });

      reply.status(200).send({ success: true, ...detection });
    },
  );

  // PATCH, not PUT: the client sends only what changed, and candidates,
  // status and enrichment are not the client's to overwrite.
  app.patch(
    "/detections/:detectionId",
    { preHandler: authenticated },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = requireUser(request);
      const { detectionId } = request.params as { detectionId: string };
      const changes = updateDetectionSchema.parse(request.body);

      const detection = await makeIdentifyController().updateDetection(
        { userId, detectionId },
        changes,
      );

      reply.status(200).send({ success: true, ...detection });
    },
  );

  app.delete(
    "/detections/:detectionId",
    { preHandler: authenticated },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = requireUser(request);
      const { detectionId } = request.params as { detectionId: string };

      await makeIdentifyController().deleteDetection({ userId, detectionId });

      reply.status(204).send();
    },
  );
}
