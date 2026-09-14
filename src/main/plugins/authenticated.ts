import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "@/kernel/errors/AppError";
import { lazy } from "@/kernel/lazy";
import { requireEnv } from "@/shared/env";

// The aws-lambda adapter decorates the request at runtime but ships no module
// augmentation for it, so the shape we rely on is declared here.
interface JwtAuthorizerContext {
  jwt?: { claims?: Record<string, string> };
}

declare module "fastify" {
  interface FastifyRequest {
    user?: { sub: string; email?: string | undefined } | undefined;
    awsLambda?: {
      event?: {
        requestContext?: { authorizer?: JwtAuthorizerContext };
      };
    };
  }
}

const verifier = lazy(() =>
  CognitoJwtVerifier.create({
    userPoolId: requireEnv("USER_POOL_ID"),
    clientId: requireEnv("USER_POOL_CLIENT_ID"),
    tokenUse: "id",
  }),
);

// In Lambda the JWT authorizer already verified the token at the edge, so the
// claims are trustworthy and re-verifying would be wasted work. Locally there
// is no API Gateway, so the token is verified here instead — same request.user
// either way, so handlers never branch on environment.
export async function authenticated(
  request: FastifyRequest,
  _reply: FastifyReply,
) {
  const claims =
    request.awsLambda?.event?.requestContext?.authorizer?.jwt?.claims;

  if (claims?.sub) {
    request.user = { sub: claims.sub, email: claims.email };
    return;
  }

  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    throw new AppError(401, "UNAUTHORIZED", "Missing bearer token");
  }

  try {
    const payload = await verifier().verify(token);
    request.user = {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired token");
  }
}

export function requireUser(request: FastifyRequest): string {
  if (!request.user?.sub) {
    throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
  }

  return request.user.sub;
}
