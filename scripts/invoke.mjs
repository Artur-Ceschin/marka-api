#!/usr/bin/env node
/**
 * Invoke the built Lambda bundles with synthetic API Gateway v2 events.
 *
 * This catches bundling and runtime-shape bugs — a missing `require` shim,
 * a shared chunk that never gets packaged, a wrong handler export — without
 * spending a deploy cycle. Both build constraints documented in CLAUDE.md
 * were found this way.
 *
 *   pnpm build && pnpm invoke
 */
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DIST = join(process.cwd(), "dist");

const cases = [
  { fn: "health", method: "GET", path: "/health", expect: 200 },
  { fn: "health", method: "GET", path: "/status", expect: 200 },
  {
    fn: "auth",
    method: "POST",
    path: "/auth/signup",
    expect: 501,
    body: { email: "a@b.com", password: "supersecret" },
  },
  {
    fn: "auth",
    method: "POST",
    path: "/auth/signin",
    expect: 501,
    body: { email: "a@b.com", password: "supersecret" },
  },
  {
    fn: "auth",
    method: "POST",
    path: "/auth/signup",
    expect: 400,
    label: "invalid payload",
    body: { email: "nope", password: "x" },
  },
];

const context = {
  awsRequestId: "local-invoke",
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

let failed = 0;
const results = [];

for (const testCase of cases) {
  const { fn, method, path, expect, label } = testCase;
  const { handler } = await load(fn);
  const res = await handler(buildEvent(testCase), context);

  const ok = res.statusCode === expect;
  if (!ok) failed++;

  results.push({
    ok,
    fn,
    name: `${method} ${path}${label ? ` (${label})` : ""}`,
    got: res.statusCode,
    expect,
    body: res.body,
  });
}

// identify needs a real multipart body, so a synthetic JSON event can't
// exercise it. Loading the bundle still proves it packages and imports
// cleanly, which is where the bundling bugs actually show up.
try {
  const mod = await load("identify");
  const ok = typeof mod.handler === "function";
  if (!ok) failed++;
  results.push({
    ok,
    fn: "identify",
    name: "bundle loads + exports handler",
    got: ok ? "ok" : "no handler export",
    expect: "ok",
  });
} catch (error) {
  failed++;
  results.push({
    ok: false,
    fn: "identify",
    name: "bundle loads + exports handler",
    got: error.message,
    expect: "ok",
  });
}

console.log("\n--- handler checks ---");
for (const r of results) {
  console.log(
    `${r.ok ? "PASS" : "FAIL"}  ${r.fn.padEnd(9)} ${r.name.padEnd(36)} ${r.got}${r.ok ? "" : `  (expected ${r.expect})`}`,
  );
  if (!r.ok && r.body) console.log(`        ${r.body}`);
}

console.log(failed === 0 ? "\nAll handlers OK\n" : `\n${failed} check(s) failed\n`);
process.exit(failed === 0 ? 0 : 1);
