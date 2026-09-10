import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "@/kernel/errors/AppError";
import { env } from "@/shared/env";

interface ErrorHandlerReturnType {
  success: boolean;
  error: string;
  code: string;
  details?: unknown;
}

export class ErrorHandler {
  handle = (error: Error, _request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof ZodError) {
      return this.handleValidationError(error, reply);
    }
    if (error instanceof AppError) {
      return this.handleAppError(error, reply);
    }
    return this.handleServerError(error, reply);
  };

  private buildErrorResponse({
    error,
    code,
    details,
  }: {
    error: string;
    code: string;
    details?: unknown;
  }): ErrorHandlerReturnType {
    return {
      success: false,
      error,
      code,
      details,
    };
  }

  private handleValidationError = (
    error: ZodError,
    reply: FastifyReply,
  ): void => {
    // Details ship in production too: a 400 describes what the caller sent,
    // so it carries nothing internal. A 500 stays opaque.
    const details = error.issues.map((issue) => ({
      field: issue.path.join(".") || "(body)",
      message: issue.message,
    }));

    const response = this.buildErrorResponse({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details,
    });

    reply.status(400).send(response);
  };

  private handleAppError = (error: AppError, reply: FastifyReply): void => {
    const response = this.buildErrorResponse({
      error: error.message,
      code: error.code,
    });

    reply.status(error.statusCode).send(response);
  };

  private handleServerError = (error: Error, reply: FastifyReply): void => {
    const response = this.buildErrorResponse({
      error: "Internal server error",
      code: "SERVER_ERROR",
      details: env.NODE_ENV === "dev" ? error.message : undefined,
    });

    reply.status(500).send(response);
  };
}
