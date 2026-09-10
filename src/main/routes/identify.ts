import { IdentifyController } from "@/applications/controllers/IdentifyController";
import { IdentifyPlantUseCase } from "@/applications/useCases/identify/IdentifyPlantUseCase";
import { identifyRequestSchema, locationSchema } from "@/applications/schemas/identify";
import { plantIdentification } from "@/infra/gateways/plantNet";
import { plantBucket } from "@/infra/clients/s3";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export function identifyRoutes(app: FastifyInstance) {
  const useCase = new IdentifyPlantUseCase(plantBucket, plantIdentification);
  const controller = new IdentifyController(useCase);
  app.post(
    "/identify",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = await request.file();

      const { latitude, longitude } = locationSchema.parse(request.query);

      if (!data) {
        throw new Error("No file uploaded");
      }

      const imageBuffer = await data.toBuffer();

      const location =
        latitude && longitude ? { latitude, longitude } : undefined;

      identifyRequestSchema.parse({ image: data, location });

      const result = await controller.identify({
        imageData: imageBuffer,
        location: location,
      });

      reply.status(200).send(result);
    },
  );
}
