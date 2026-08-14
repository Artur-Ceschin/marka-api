import fastify from "fastify";
import multipart from "@fastify/multipart";
import { healthRoutes } from "@/routes/health";
import { ErrorHandler } from "./middleware/errorHandler";
import { createLogger } from "./utils/logger";
import { identifyRoutes } from "./routes/identify";

export function buildApp() {
  const app = fastify({
    logger: true,
  });

  const errorHandler = new ErrorHandler();
  app.setErrorHandler(errorHandler.handle);
  app.register(multipart);

  app.register(healthRoutes);
  app.register(identifyRoutes);

  return { app, logger: createLogger(app) };
}
