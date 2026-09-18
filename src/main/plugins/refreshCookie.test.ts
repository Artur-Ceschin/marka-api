import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from "@/main/plugins/refreshCookie";

function fakeReply() {
  const headers: Record<string, string> = {};
  const reply = {
    header(name: string, value: string) {
      headers[name] = value;
      return reply;
    },
  };

  return { headers, reply: reply as unknown as FastifyReply };
}

const requestWithCookie = (cookie?: string) =>
  ({ headers: cookie === undefined ? {} : { cookie } }) as FastifyRequest;

describe("refresh cookie", () => {
  it("is out of script's reach and never sent cross-site", () => {
    const { headers, reply } = fakeReply();

    setRefreshCookie(reply, "eyJ.refresh.token");

    const cookie = headers["set-cookie"] ?? "";
    assert.match(cookie, /^__Secure-marka-refresh=eyJ\.refresh\.token;/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Strict/);
    // Scoped to the auth endpoints, not attached to every API call.
    assert.match(cookie, /Path=\/auth/);
    assert.doesNotMatch(cookie, /Domain=/);
  });

  it("reads the token back from among other cookies", () => {
    // API Gateway's cookie list, as the Lambda adapter joins it.
    const request = requestWithCookie(
      "theme=dark;__Secure-marka-refresh=eyJ.refresh.token;locale=pt-BR",
    );

    assert.equal(readRefreshCookie(request), "eyJ.refresh.token");
  });

  it("finds nothing when the cookie is absent or empty", () => {
    assert.equal(readRefreshCookie(requestWithCookie()), undefined);
    assert.equal(
      readRefreshCookie(requestWithCookie("__Secure-marka-refresh=")),
      undefined,
    );
  });

  it("clears with the same attributes, or the browser keeps the original", () => {
    const { headers, reply } = fakeReply();

    clearRefreshCookie(reply);

    const cookie = headers["set-cookie"] ?? "";
    assert.match(cookie, /^__Secure-marka-refresh=;/);
    assert.match(cookie, /Max-Age=0/);
    assert.match(cookie, /Path=\/auth/);
  });
});
