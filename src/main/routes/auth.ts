import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  confirmSignUpSchema,
  forgotPasswordSchema,
  googleSignInSchema,
  resendCodeSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/applications/schemas/auth";
import { AppError } from "@/kernel/errors/AppError";
import { makeAuthController } from "@/main/factories/makeAuthController";
import { authenticated, requireUser } from "@/main/plugins/authenticated";
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from "@/main/plugins/refreshCookie";
import type { SignInResponse } from "@/shared/types/auth";

function startSession(reply: FastifyReply, tokens: SignInResponse): void {
  const { refreshToken, ...session } = tokens;

  setRefreshCookie(reply, refreshToken);
  reply.status(200).send(session);
}

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

      startSession(reply, await makeAuthController().signIn(body));
    },
  );

  app.post(
    "/auth/google",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = googleSignInSchema.parse(request.body);

      startSession(reply, await makeAuthController().signInWithGoogle(body));
    },
  );

  app.post(
    "/auth/refresh",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const refreshToken = readRefreshCookie(request);

      if (!refreshToken) {
        throw new AppError(
          401,
          "SESSION_EXPIRED",
          "Your session has expired. Sign in again",
        );
      }

      const response = await makeAuthController().refresh({ refreshToken });

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

  app.post(
    "/auth/signout",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const refreshToken = readRefreshCookie(request);

      if (refreshToken) {
        await makeAuthController().signOut({ refreshToken });
      }

      clearRefreshCookie(reply);
      reply.status(204).send();
    },
  );

  app.get(
    "/me",
    { preHandler: authenticated },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sub = requireUser(request);

      const response = await makeAuthController().me({
        sub,
        email: request.user?.email,
      });

      reply.status(200).send(response);
    },
  );
}
