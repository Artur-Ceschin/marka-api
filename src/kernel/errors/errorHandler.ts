import { env } from "@/shared/env";
import { AppError } from "@/kernel/errors/AppError";
import { FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";

interface ErrorHandlerReturnType {
  success: boolean;
  error: string;
  code: string;
  details?: unknown;
}

export class ErrorHandler {
  handle = (error: Error, request: FastifyRequest, reply: FastifyReply) => {
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

  /**
   * The deliberate exception to hiding `details` in production.
   *
   * A 400 describes what the *caller* sent, and a Zod issue carries only the
   * field path and a message we wrote — never the submitted value. Hiding it
   * leaks nothing and helps no one: the client is left unable to say which
   * field failed, which pushes it to re-implement our validation rules and
   * drift from them. A 500 stays opaque because its message can carry
   * internals; a 400 has none to carry.
   */
  private handleValidationError = (
    error: ZodError,
    reply: FastifyReply,
  ): void => {
    const details = error.issues.map((issue) => ({
      // Empty path means the failure is the body itself, not a field in it.
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
