import fastify, {
  FastifyPluginAsync,
  FastifyPluginCallback,
} from "fastify";
import { ErrorHandler } from "@/kernel/errors/errorHandler";
import { createLogger } from "@/shared/logger";

type Plugin = FastifyPluginAsync | FastifyPluginCallback;

/**
 * Builds a Fastify app with only the plugins/routes it needs.
 * Each Lambda entry point passes its own slice, so auth doesn't
 * carry multipart and identify doesn't carry auth routes.
 */
export function buildApp(plugins: Plugin[]) {
  const app = fastify({ logger: true });

  const errorHandler = new ErrorHandler();
  app.setErrorHandler(errorHandler.handle);

  for (const plugin of plugins) {
    app.register(plugin);
  }

  return { app, logger: createLogger(app) };
}
