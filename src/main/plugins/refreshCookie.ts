import type { FastifyReply, FastifyRequest } from "fastify";

const NAME = "__Secure-marka-refresh";
// Cognito's refresh token lifetime: the cookie should not outlive what it holds.
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const ATTRIBUTES = "Path=/auth; HttpOnly; Secure; SameSite=Strict";

export function setRefreshCookie(
  reply: FastifyReply,
  refreshToken: string,
): void {
  reply.header(
    "set-cookie",
    `${NAME}=${refreshToken}; Max-Age=${MAX_AGE_SECONDS}; ${ATTRIBUTES}`,
  );
}

export function clearRefreshCookie(reply: FastifyReply): void {
  reply.header("set-cookie", `${NAME}=; Max-Age=0; ${ATTRIBUTES}`);
}

export function readRefreshCookie(request: FastifyRequest): string | undefined {
  for (const pair of (request.headers.cookie ?? "").split(";")) {
    const [name, ...value] = pair.trim().split("=");

    if (name === NAME) {
      return value.join("=") || undefined;
    }
  }

  return undefined;
}
