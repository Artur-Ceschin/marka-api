import { FastifyInstance } from "fastify";

export class Logger {
  constructor(private fastifyLogger: any) {}

  info(message: string, context?: Record<string, unknown>) {
    this.fastifyLogger.info({ msg: message, ...context });
  }

  error(message: string, error?: Error, context?: Record<string, unknown>) {
    this.fastifyLogger.error({
      msg: message,
      error: error?.message,
      stack: error?.stack,
      ...context,
    });
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.fastifyLogger.warn({ msg: message, ...context });
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.fastifyLogger.debug({ msg: message, ...context });
  }
}

export function createLogger(fastifyInstance: FastifyInstance) {
  return new Logger(fastifyInstance.log);
}
