import multipart from "@fastify/multipart";
import { buildApp } from "@/main/app";
import { healthRoutes } from "@/main/routes/health";
import { authRoutes } from "@/main/routes/auth";
import { identifyRoutes } from "@/main/routes/identify";
import { env } from "@/shared/env";

const { app, logger } = buildApp([
  multipart,
  healthRoutes,
  authRoutes,
  identifyRoutes,
]);

app
  .listen({
    host: "0.0.0.0",
    port: env.PORT,
  })
  .then(() => {
    logger.info("Server starting", { port: env.PORT });
  });
