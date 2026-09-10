import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  identifyRequestSchema,
  listDetectionsSchema,
  locationSchema,
} from "@/applications/schemas/identify";
import { makeIdentifyController } from "@/main/factories/makeIdentifyController";
import { authenticated, requireUser } from "@/main/plugins/authenticated";

export function identifyRoutes(app: FastifyInstance) {
  app.post(
    "/identify",
    { preHandler: authenticated },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = requireUser(request);
      const data = await request.file();

      const { latitude, longitude } = locationSchema.parse(request.query);

      if (!data) {
        throw new Error("No file uploaded");
      }

      const imageBuffer = await data.toBuffer();

      const location =
        latitude && longitude ? { latitude, longitude } : undefined;

      identifyRequestSchema.parse({ image: data, location });

      const result = await makeIdentifyController().identify({
        userId,
        imageData: imageBuffer,
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
