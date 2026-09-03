import { signInSchema, signUpSchema } from "@/applications/schemas/auth";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export function authRoutes(app: FastifyInstance) {
  app.post(
    "/auth/signup",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = signUpSchema.safeParse(request.body);

      if (!result.success) {
        throw result.error;
      }

      reply.status(501).send({
        success: false,
        error: "Sign up is not implemented yet",
        code: "NOT_IMPLEMENTED",
      });
    },
  );

  app.post(
    "/auth/signin",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const result = signInSchema.safeParse(request.body);

      if (!result.success) {
        throw result.error;
      }

      reply.status(501).send({
        success: false,
        error: "Sign in is not implemented yet",
        code: "NOT_IMPLEMENTED",
      });
    },
  );
}
