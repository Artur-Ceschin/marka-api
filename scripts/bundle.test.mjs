/**
 * Checks the built artifacts, not the source.
 *
 * What runs in Lambda is an esbuild bundle, and the translation from src/ to
 * dist/ can break in ways tsc cannot see: a shared chunk that never gets
 * packaged (splitting), a missing require shim (the createRequire banner), a
 * handler that isn't exported. Both of those bit this project before and both
 * typecheck perfectly — see "Build Constraints" in CLAUDE.md.
 *
 * Run against dist/, so it needs `pnpm build` first: `pnpm test:bundle`.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";

const DIST = join(process.cwd(), "dist");
const FUNCTIONS = ["health", "auth", "identify"];

const context = {
  awsRequestId: "bundle-test",
  getRemainingTimeInMillis: () => 30_000,
};

const load = (fn) => import(pathToFileURL(join(DIST, `${fn}.mjs`)).href);

const buildEvent = ({ method, path, body }) => ({
  version: "2.0",
  routeKey: `${method} ${path}`,
  rawPath: path,
  rawQueryString: "",
  headers: body ? { "content-type": "application/json" } : {},
  requestContext: {
    http: { method, path, sourceIp: "127.0.0.1" },
    stage: "$default",
  },
  body: body ? JSON.stringify(body) : undefined,
  isBase64Encoded: false,
});

describe("built Lambda bundles", () => {
  it("has a bundle for every function", () => {
    for (const fn of FUNCTIONS) {
      assert.ok(
        existsSync(join(DIST, `${fn}.mjs`)),
        `dist/${fn}.mjs missing — run pnpm build`,
      );
    }
  });

  // Importing is the assertion: a bad banner or a missing chunk throws here,
  // which is exactly the cold-start failure we are trying not to deploy.
  for (const fn of FUNCTIONS) {
    it(`${fn}: imports cleanly and exports a handler`, async () => {
      const { handler } = await load(fn);
      assert.equal(typeof handler, "function");
    });
  }

  it("health responds through the aws-lambda adapter", async () => {
    const { handler } = await load("health");
    const res = await handler(
      buildEvent({ method: "GET", path: "/health" }),
      context,
    );

    assert.equal(res.statusCode, 200);
  });

  it("auth returns per-field details on a validation failure", async () => {
    const { handler } = await load("auth");
    const res = await handler(
      buildEvent({
        method: "POST",
        path: "/auth/signup",
        body: { email: "nope", password: "234" },
      }),
      context,
    );

    assert.equal(res.statusCode, 400);

    // Guards the production behaviour specifically: details used to be
    // stripped whenever NODE_ENV !== "dev", leaving clients a bare
    // "Validation failed" they could do nothing with.
    const body = JSON.parse(res.body);
    assert.equal(body.code, "VALIDATION_ERROR");
    assert.ok(Array.isArray(body.details) && body.details.length > 0);
    assert.ok(body.details.every((d) => d.field && d.message));
  });
});
