# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Marka API** is a plant detection API that identifies plants from photos using PlantNet and AI models, returning detailed plant information based on the image and user location. This is both a **shipping product** and a **learning project** where the user prioritizes:

- **Learning AI/ML concepts** with real implementation experience
- **Code quality and clarity** (avoiding "vibe code")
- **Fast iteration and deployment** without over-engineering

## Architecture

### Tech Stack

- **Framework**: Fastify (lightweight, performant HTTP server)
- **Language**: TypeScript with strict mode enabled
- **Runtime Validation**: Zod (runtime type checking for API contracts)
- **Build**: esbuild (direct, via `esbuild.config.mjs`)

### High-Level Structure

```
sls/                  Serverless config, split by concern
  config/             provider.yml + custom.yml (shared variable definitions)
  functions/          one file per deployed function
  resources/          CloudFormation for S3 and DynamoDB
scripts/              local tooling (synthetic Lambda invocation)
src/
  applications/       controllers, use cases, Zod schemas
  infra/              external integrations (PlantNet, S3) — currently mocked
  kernel/             cross-cutting concerns (error handling)
  main/               composition root
    app.ts            buildApp(plugins) — assembles a Fastify app from a slice
    server.ts         local dev only: every route in one process
    routes/           Fastify plugins, grouped by domain
    functions/        Lambda entry points — one per deployed function
  shared/             env validation, logger, domain types
```

Dependencies point inward: `main` knows everything, `applications` knows
`shared` and `infra` interfaces, `shared` knows nothing.

### Key Design Principles

- **Route Modules**: Each feature/domain gets a route file that exports a Fastify plugin
- **Environment Validation**: Zod schema in `shared/env.ts` validates all env vars at startup—fail fast
- **Type Safety**: Strict TypeScript settings (noUncheckedIndexedAccess, exactOptionalPropertyTypes) enforced to catch bugs early
- **No Over-Engineering**: Add abstractions only when you have 3+ similar cases; premature abstractions slow learning

## Development Commands

```bash
# Development
pnpm dev              # Run all routes in one local process (tsx watch, port 3333)

# Build & verify
pnpm build            # Bundle each Lambda handler to dist/*.mjs via esbuild
pnpm invoke           # Run built bundles against synthetic API Gateway events
pnpm typecheck        # tsc --noEmit
pnpm lint             # ESLint (.mjs only — see eslint.config.mjs)

# Deploy
pnpm sls:deploy       # Build, then `serverless deploy`
pnpm sls:logs identify # Tail one function's CloudWatch logs
pnpm sls:print        # Show the fully resolved serverless config
pnpm sls:remove       # Delete the whole stack from AWS

# Environment
# Copy .env.example to .env and populate (PORT, NODE_ENV)
```

## Important Patterns

### Adding Routes

Routes are Fastify plugins in `src/main/routes/`. Register them in the
Lambda entry point that should serve them, and in `src/main/server.ts`
for local dev:

```typescript
// src/main/routes/plants.ts
import { FastifyInstance } from "fastify";

export function plantRoutes(app: FastifyInstance) {
  app.post("/detect", async (request) => {
    // Handler
  });
}

// src/main/functions/identify.ts
import { plantRoutes } from "@/main/routes/plants";
const { app } = buildApp([plantRoutes]);
```

A new route on an existing domain needs a matching `httpApi` event in
`sls/functions/<domain>.yml`, or API Gateway will never route to it.

### Environment Variables

Define in `src/shared/env.ts` as a Zod schema. This validates at startup and provides typed access throughout the app.

### Runtime Validation

Use Zod for request bodies, query params, and responses. This ensures API contracts are enforced at the boundary.

## Learning Notes for Future Work

This is a teaching project as much as a product. When making decisions:

- **Prioritize clarity over cleverness.** A simple approach that can be explained in 2 sentences beats a "clever" pattern.
- **Ask "why does this work?" not just "does it work?"** Understand what PlantNet returns, how geolocation improves results, why certain AI models are chosen.
- **No "vibe code."** Every design decision should have a clear reason tied to either performance, maintainability, or learning a specific concept.
- **Avoid speculative abstractions.** Only refactor when shipping the same pattern for the 3rd time.

## AI/ML Integration Notes

When integrating PlantNet API and AI models:

- Document the API contract and what each field means
- Add type-safe schemas for API responses (Zod)
- Include comments on _why_ certain model choices or parameters were made (helps learning)
- Test edge cases (poor photo quality, location accuracy, rare plants)

## Infrastructure (Serverless Framework)

### Architecture Overview

Marka API is **three Lambda functions behind one API Gateway HTTP API**. There
are no servers, no load balancer, and no VPC — the whole stack costs ~$0/month
at low traffic and stays inside the Lambda free tier.

```
Internet -> API Gateway (HTTP API)
              |-- health    GET  /health, /status      128MB /  5s
              |-- auth      POST /auth/signup, /signin 256MB / 10s
              |-- identify  POST /identify            1024MB / 29s
                              |-- S3 (plant images)
                              |-- DynamoDB (detections)
```

### Why Split Into Three Functions?

Domain-based splitting, not one-Lambda-per-route. Each function gets memory and
a timeout matched to its actual work: `health` is trivial and cheap, `identify`
buffers images and calls AI models so it needs CPU (in Lambda, memory *is* CPU).
A single "lambdalith" would force `identify`'s 1024MB onto every health check.

Splitting further — one function per route — would multiply cold starts and
deploy surface for no benefit. Three domains is the defensible middle.

### How The Code Is Wired

- `src/main/app.ts` exports `buildApp(plugins)` — a Fastify app containing only the
  plugins it is handed. This is what makes the split cheap.
- `src/main/functions/*.ts` are the Lambda entry points. Each calls `buildApp` with
  its own slice, so `auth` never loads multipart and `identify` never loads
  auth routes.
- `src/main/server.ts` is local dev only: it registers *every* route in one process,
  so `pnpm dev` behaves like a normal API server.
- `@fastify/aws-lambda` translates API Gateway v2 events into Fastify requests.

### Build Constraints (learned the hard way)

- **`splitting: false` in `esbuild.config.mjs` is required.** With splitting on,
  esbuild emits a shared chunk; since each function is packaged alone via
  `package.patterns`, every Lambda would deploy without its dependencies and
  fail at cold start.
- **The `createRequire` banner is required.** `@fastify/aws-lambda` is CommonJS
  and calls `require()`. Bundled into ESM, `require` does not exist, and you get
  `Dynamic require of "crypto" is not supported` at runtime.
- **`.mjs` output** tells the Lambda Node runtime to load the file as an ES
  module without shipping a `package.json`.
- **`binaryMimeTypes`** must be set on the `identify` handler, or API Gateway's
  base64 body reaches Fastify as a string and `toBuffer()` yields garbage.

### Known Limits

- API Gateway HTTP API has a **hard 29-second request timeout**.
- Lambda's synchronous payload limit is **6MB** (API Gateway allows 10MB).
  Phone photos can exceed this — the fix is **presigned S3 upload URLs**, where
  the client uploads directly to S3 and only sends the key to `/identify`.
  Not built yet.

### IAM

One role shared by all three functions, scoped to the specific bucket and table
ARNs. Per-function least privilege needs the `serverless-iam-roles-per-function`
plugin; it is not worth adding until a function handles data the others should
not touch.

### Testing Handlers Locally

Handlers can be invoked with synthetic API Gateway v2 events without deploying.
This catches bundling and runtime-shape bugs (both of the build constraints
above were found this way) before spending a deploy cycle.

### Deployment Workflow

```bash
pnpm sls:deploy       # build + deploy all functions
serverless deploy function -f identify   # fast path: one function's code only
pnpm sls:remove                # tear the whole stack down
```

`serverless deploy function` skips CloudFormation and just swaps the code — use
it for iteration, and the full `pnpm sls:deploy` whenever `serverless.yml` changes.

### Serverless Config Layout

`serverless.yml` is a thin index; the real content lives in `sls/`:

```
serverless.yml        service name + ${file(...)} references
sls/config/custom.yml     resource names, defined once
sls/config/provider.yml   runtime, region, IAM, environment
sls/functions/*.yml       memory, timeout, package patterns, routes
sls/resources/*.yml       raw CloudFormation
```

### The AWS Profile Trap

`pnpm sls:deploy` pins `AWS_PROFILE=marka` on purpose. Serverless resolves
`${aws:accountId}` and friends through the **default credential chain at
parse time**, *before* `provider.profile` is applied. The default profile on
this machine points at a different AWS account, so an unpinned deploy silently
builds ARNs for the wrong account.

For the same reason, IAM resource ARNs use `Fn::GetAtt` on the logical
resource IDs rather than hand-built strings. CloudFormation resolves those at
deploy time in whatever account is actually being deployed into, so they
cannot go wrong. Prefer `!Ref` / `!GetAtt` over `${aws:accountId}` anywhere
correctness matters.

Note `Fn::Join` rather than `Fn::Sub` when appending to an ARN: Serverless
tries to resolve `${...}` inside a `Sub` string as its own variable syntax.

### Custom Domain

`api.markaplant.app` → API Gateway HTTP API, defined in `sls/resources/domain.yml`.

Two things make this simpler than it looks:

- The ACM cert is a **wildcard** (`markaplant.app` + `*.markaplant.app`), so any
  new subdomain needs no new certificate and no new validation.
- HTTP API custom domains are **REGIONAL**. API Gateway terminates TLS itself
  and gives you a `d-xxxx.execute-api.<region>.amazonaws.com` target. CloudFront
  is only involved for edge-optimized REST APIs — this is not one.

**DNS lives in Cloudflare, not AWS.** There is a Route53 hosted zone for
`markaplant.app` in the account, but the domain's nameservers point at
Cloudflare, so that zone is orphaned — records created there do nothing.
Always check `dig +short NS <domain>` before assuming Route53 is authoritative.

Two records belong in Cloudflare, both **DNS-only (grey cloud)**:

| Name | Type | Value | Why |
|---|---|---|---|
| `api` | CNAME | `d-bpydzt57wl.execute-api.us-east-1.amazonaws.com` | routes traffic |
| `_b311a48a6a415bf8bdc8a56a30c230a0` | CNAME | `_bebc725dcf66d188b2c8cae649584562.jkddzztszm.acm-validations.aws.` | ACM auto-renewal |

The second one matters: ACM renews by re-checking the validation record. If it
does not resolve in *live* DNS the renewal silently fails and the cert expires.
A cert also has to be **in use** by a resource to be renewal-eligible at all —
an unattached cert reports `RenewalEligibility: INELIGIBLE` and will not renew.
