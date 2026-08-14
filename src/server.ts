import { buildApp } from "./app.js";
import { env } from "@/utils/env";

const { app, logger } = buildApp();

app
  .listen({
    host: "0.0.0.0",
    port: env.PORT,
  })
  .then(() => {
    logger.info("Server starting", { port: env.PORT });
  });
