import { FastifyInstance } from "fastify";
import pkg from "../../package.json" with { type: "json" };

export function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    service: pkg.name,
    version: pkg.version,
    timestamp: new Date().toISOString(),
  }));

  app.get("/status", async () => {
    return {
      status: "ok",
      version: pkg.version,
      uptime: process.uptime(),
    };
  });
}
