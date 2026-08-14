import { IdentifyController } from "@/application/controllers/IdentifyController";
import { IdentifyPlantUseCase } from "@/application/useCases/IdentifyPlantUseCase";
import { identifyRequestSchema, locationSchema } from "@/schemas/identify";
import { plantIdentification } from "@/services/plantNet/plantIdentification";
import { plantBucket } from "@/services/s3/plantBucket";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export function identifyRoutes(app: FastifyInstance) {
  const useCase = new IdentifyPlantUseCase(plantBucket, plantIdentification);
  const controller = new IdentifyController(useCase);
  app.post(
    "/identify",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = await request.file();

      const queryResult = locationSchema.safeParse(request.query);

      if (!queryResult.success) {
        throw queryResult.error;
      }

      if (!data) {
        throw new Error("No file uploaded");
      }

      const imageBuffer = await data.toBuffer();

      const { latitude, longitude } = queryResult.data;
      const location =
        latitude && longitude ? { latitude, longitude } : undefined;

      const validationResult = identifyRequestSchema.safeParse({
        image: data,
        location,
      });

      if (!validationResult.success) {
        throw validationResult.error;
      }

      const result = await controller.identify({
        imageData: imageBuffer,
        location: location,
      });

      reply.status(200).send(result);
    },
  );
}
