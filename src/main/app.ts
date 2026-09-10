import fastify, {
  type FastifyPluginAsync,
  type FastifyPluginCallback,
} from "fastify";
import { ErrorHandler } from "@/kernel/errors/errorHandler";
import { createLogger } from "@/shared/logger";

type Plugin = FastifyPluginAsync | FastifyPluginCallback;

export function buildApp(plugins: Plugin[]) {
  const app = fastify({ logger: true });

  const errorHandler = new ErrorHandler();
  app.setErrorHandler(errorHandler.handle);

  for (const plugin of plugins) {
    app.register(plugin);
  }

  return { app, logger: createLogger(app) };
}
