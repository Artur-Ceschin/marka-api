import {
  confirmSignUpSchema,
  refreshSchema,
  resendCodeSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/applications/schemas/auth";
import { makeAuthController } from "@/main/factories/makeAuthController";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export function authRoutes(app: FastifyInstance) {
  app.post(
    "/auth/signup",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = signUpSchema.parse(request.body);

      const response = await makeAuthController().signUp(body);

      reply.status(201).send(response);
    },
  );

  app.post(
    "/auth/confirm",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = confirmSignUpSchema.parse(request.body);

      const response = await makeAuthController().confirmSignUp(body);

      reply.status(200).send(response);
    },
  );

  app.post(
    "/auth/forgot-password",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = forgotPasswordSchema.parse(request.body);

      const response = await makeAuthController().forgotPassword(body);

      reply.status(200).send(response);
    },
  );

  app.post(
    "/auth/reset-password",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = resetPasswordSchema.parse(request.body);

      const response = await makeAuthController().resetPassword(body);

      reply.status(200).send(response);
    },
  );

  app.post(
    "/auth/signin",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = signInSchema.parse(request.body);

      const response = await makeAuthController().signIn(body);

      reply.status(200).send(response);
    },
  );

  app.post(
    "/auth/refresh",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = refreshSchema.parse(request.body);

      const response = await makeAuthController().refresh(body);

      reply.status(200).send(response);
    },
  );

  app.post(
    "/auth/resend-code",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = resendCodeSchema.parse(request.body);

      const response = await makeAuthController().resendCode(body);

      reply.status(200).send(response);
    },
  );
}
