import { env } from "@/utils/env";
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
    console.error("Server error:", error);

    const response = this.buildErrorResponse({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: env.NODE_ENV === "dev" ? error.message : undefined,
    });

    reply.status(400).send(response);
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
