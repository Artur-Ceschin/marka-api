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
    useCases/<domain>/  one folder per domain, tests colocated
  infra/              external integrations (PlantNet, S3) — currently mocked
  kernel/             cross-cutting concerns (error handling)
  main/               composition root
    app.ts            buildApp(plugins) — assembles a Fastify app from a slice
    server.ts         local dev only: every route in one process
    routes/           Fastify plugins, grouped by domain
    factories/        picks concrete implementations and wires them together
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
pnpm test             # Unit tests (node:test via tsx), no AWS needed
pnpm test:bundle      # Build, then run the bundles against synthetic events
pnpm typecheck        # tsc --noEmit
pnpm lint             # Biome: lint + format check
pnpm lint:fix         # Biome: apply safe fixes
pnpm verify           # lint + typecheck + test + test:bundle (what CI runs)

# Deploy
pnpm sls:deploy       # Build, then `serverless deploy`
pnpm sls:logs identify # Tail one function's CloudWatch logs
pnpm sls:print        # Show the fully resolved serverless config
pnpm sls:remove       # Delete the stack (fails until deletion protection is off)

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

### Data Protection

Both DynamoDB tables carry three separate protections, because they fail in
different ways:

- `DeletionProtectionEnabled: true` blocks the `DeleteTable` API — console,
  CLI, or `sls:remove`.
- `DeletionPolicy: Retain` + `UpdateReplacePolicy: Retain` stop CloudFormation
  destroying a table on stack deletion *or on replacement*. The second matters
  more than it looks: renaming a table in `custom.yml` is a one-line edit that
  would otherwise drop the populated table and create an empty one, and
  deletion protection does not cover it because it is a replace, not a delete.
- Point-in-time recovery restores to any second in the last 35 days. It is the
  only one of the three that helps when code destroys the data — a bad
  migration, a delete loop with the wrong key — rather than removing the table.

**`pnpm sls:remove` no longer works unaided.** That is the point, but it means
a genuine teardown is a deliberate two-step: disable deletion protection on
both tables first (`aws dynamodb update-table --no-deletion-protection-enabled`),
then remove the stack. The tables survive it either way thanks to `Retain`, so
they must also be deleted by hand afterwards.

The stage is named `dev`, but it is the only stack and `api.markaplant.app`
points at it. Treat it as production.

**The S3 bucket has none of this** — no `DeletionPolicy`, no versioning. Plant
photos are currently deletable and unrecoverable.

### IAM

One role shared by all three functions, scoped to the specific bucket and table
ARNs. Per-function least privilege needs the `serverless-iam-roles-per-function`
plugin; it is not worth adding until a function handles data the others should
not touch.

### Auth: Cognito + DynamoDB

Two systems, one clean split:

- **Cognito owns credentials.** Password hashing, token signing, refresh
  tokens, email verification, and password reset later. No password ever
  reaches our code or our database.
- **DynamoDB owns the profile.** `UsersTable`, keyed on Cognito's `sub` —
  not the email, because emails change and would orphan every row keyed on
  the old one. This is where app data that Cognito is a bad database for
  lives, and where detections will eventually join.

The chain is route -> `AuthController` -> use case -> gateway/repository,
wired in `main/factories/makeAuthController.ts`. Construction lives there
rather than inside the controller on purpose: a class that builds its own
dependencies cannot be handed fakes, which would make the use case tests
impossible. The route imports the factory and nothing else.
The route is the only layer that knows this is HTTP: it parses the body with
Zod and picks the status code. Everything below it takes and returns domain
types, which is what would let the same use cases be driven by a queue
consumer or a CLI later.

Three endpoints, because email verification is real:

```
POST /auth/signup           -> creates the user, Cognito emails a 6-digit code
POST /auth/confirm          -> {email, code}, marks the account confirmed
POST /auth/signin           -> {accessToken, idToken, refreshToken}
POST /auth/forgot-password  -> {email}, Cognito emails a reset code
POST /auth/reset-password   -> {email, code, password}
POST /auth/resend-code      -> {email}, a new sign-up confirmation code
POST /auth/refresh          -> {refreshToken} -> new accessToken + idToken
```

**Tokens.** `/identify` sits behind an API Gateway JWT authorizer, which
validates the `aud` claim — so clients send the **idToken**. Cognito access
tokens carry `client_id` instead of `aud` and are rejected. The refresh token
is never sent to this API except to `/auth/refresh`; it is a 30-day credential
whose only other valid recipient is Cognito.

ID and access tokens last 1 hour, the refresh token 30 days. A client should
refresh proactively on the `exp` claim and reactively on a 401, retrying once.
Cognito does not rotate refresh tokens, so `/auth/refresh` returns only new ID
and access tokens.

A `NotAuthorizedException` during refresh means the refresh token expired or
was revoked, which is a different recovery path from a bad password — the
gateway maps it to `SESSION_EXPIRED` rather than the shared
`INVALID_CREDENTIALS` wording, so the client knows to show sign-in.

`/auth/resend-code` exists because an expired confirmation code otherwise
strands a user permanently: they cannot sign in (unconfirmed) and cannot sign
up again (409). Like `/auth/forgot-password`, it answers identically for
unknown emails.

**`/auth/forgot-password` always answers 200 with the same message**, even for
an address with no account. Returning a 404 would be friendlier to someone who
mistyped their own email, and would also let anyone test a list of addresses
for which ones have accounts here — no credentials required. The user who
mistyped receives no email either way, so they learn the same thing. The
gateway swallows `UserNotFoundException` for this call specifically, and a test
pins that; every other error still surfaces.

**`/auth/reset-password` returns no tokens.** Completing a reset proves the
caller can read the mailbox, not that they meant to start a session. Issuing
tokens there would turn a leaked reset code straight into a session instead of
something the real owner can still race to change. The client signs in
afterwards like normal.

#### Auth email

Cognito's default sender is `no-reply@verificationemail.com` — a shared AWS
domain with no SPF, DKIM or DMARC alignment to markaplant.app, and a hard
**50 messages/day** cap that cannot be raised. That sender is why the mail
lands in spam; markup has nothing to do with it. Sender authentication is
weighted far above design by every major inbox provider.

So the fix is SES with our own domain identity (`sls/resources/ses.yml`),
sending as `noreply@markaplant.app` with DKIM signing and a custom MAIL FROM
subdomain. The MAIL FROM subdomain exists so SPF authenticates *our* domain
rather than amazonses.com, which gets SPF aligned for DMARC alongside DKIM.

**This could not ship in one deploy.** Cognito rejects a `DEVELOPER` email
configuration naming an unverified SES identity, and CloudFormation rolls the
whole stack back when it does. The order was:

1. Deploy `sls/resources/ses.yml` — creates the identity and outputs three
   DKIM CNAME records.
2. Add those three CNAMEs in Cloudflare, **DNS-only (grey cloud)** — a proxied
   CNAME resolves to Cloudflare's IPs instead of the DKIM target and never
   verifies — plus the MAIL FROM `MX` and `TXT`, plus a `_dmarc` `TXT`. As
   with the API domain, DNS is Cloudflare and the Route53 zone is orphaned.
3. Wait for SES to report the domain verified (took ~40s once DNS resolved).
4. Switch `EmailConfiguration` to `DEVELOPER` in `sls/resources/cognito.yml`
   and deploy.

**`AWS::SES::EmailIdentity` has no `Arn` attribute.** `Fn::GetAtt` supports
only the six DKIM token names and values; `Ref` returns the domain name. The
`SourceArn` is therefore built with `Fn::Join` over `AWS::Region` and
`AWS::AccountId`, with `Ref` on the identity supplying the domain — which also
creates the dependency edge so the identity exists before the pool updates.

**SES starts in sandbox**, where it will only deliver to verified addresses.
Request production access from the SES console before real signups, or every
address that is not your own silently fails.

No SES sending-authorization policy is needed — Cognito creates the
`AWSServiceRoleForAmazonCognitoIdpEmailService` role for this. A policy is
only required when mixing the default sender with a verified identity.

**One template covers three emails.** Cognito has no separate forgot-password
template: sign-up, resend, and password reset all read
`VerificationMessageTemplate` when verification is code-based. The copy is
therefore neutral ("your verification code") because it has to be true for
all three. Per-message wording requires a `CustomMessage` Lambda trigger,
which would replace that block and add a fourth function.

The markup is table-based with inline CSS and no external images: most clients
strip `<style>`, Outlook ignores flex and grid, images are blocked by default,
and image-heavy mail with little text scores badly with spam filters.

**Brand colors** (hardcoded inline — email clients do not resolve `var()`):

| Role | Hex |
|---|---|
| Ink / primary green | `#23422F` |
| Accent lime | `#DFF5C0` |
| Background bone | `#F3F1EA` |
| Surface white | `#FFFFFF` |
| Muted text | `#5C6B5F` |
| Border | `#294E3B33` |

The `#23422F` / `#DFF5C0` pairing is the brand. In the email it lands on the
verification code panel rather than a button, because a code-based flow has no
URL to link to.

Two adaptations the email forces. The border token is 8-digit hex, which is
CSS Color 4 and gets dropped by Outlook and others, so it is pre-flattened per
background: `#D4DCD8` over white, `#CBD0C7` over bone. And Switzer is not used
at all — webfonts fail in Outlook and Gmail's web client strips `<link>` — so
email uses the system stack while the app keeps Switzer at 400/500.

Measured contrast: lime on ink 9.5:1, muted on surface 5.6:1, muted on bone
5.0:1, heading on surface 11.1:1. All pass AA, which is why body text stays at
16px and nothing muted drops below 14px.

When a linked flow does appear (link-based verification, or a marketing send),
the button markup is:

```html
<a href="..." style="background-color:#23422F;color:#DFF5C0;
   font-size:16px;font-weight:500;text-decoration:none;
   padding:14px 28px;border-radius:6px;display:inline-block;">
  Confirm your account
</a>
```

Outlook ignores `border-radius` and renders it square; either accept that or
wrap it in a VML button. Never use `border-radius:9999px`. Keep weight at 500
even though the fallback stack has no medium and may render 400 — jumping to
700 to compensate would not match the app.

**The user pool client has no secret and does not allow
`ALLOW_USER_PASSWORD_AUTH`.** Sign-in goes through `AdminInitiateAuth`,
which is SigV4-signed with the Lambda's IAM role. So holding the (public)
client id is not enough to trade a password for tokens — only this backend
can. A client secret would add SECRET_HASH computation and a secret to
manage for no gain on top of that.

**The password policy is written twice on purpose** — a Zod schema in
`applications/schemas/auth.ts` and a `PasswordPolicy` in
`sls/resources/cognito.yml`. Zod catches a weak password at the boundary as
a clean 400; without it Cognito catches it a round trip later with a
vendor-shaped message. If you change one, change the other.

**Cognito exceptions are mapped to HTTP statuses** in one table in
`infra/gateways/cognito.ts`. Anything not in that table keeps bubbling and
becomes a 500, which is the point: a wrong confirmation code and a broken
database should not look the same to a client. `NotAuthorizedException` and
`UserNotFoundException` deliberately map to the *same* 401, so the API
never reveals whether an email is registered.

**Sign-up writes to two systems with no transaction.** Cognito first (it
owns the email-uniqueness check), then the profile row keyed on the `sub`
it returns. If the DynamoDB write fails, the Cognito user survives and a
retry gets a 409. The AWS-native fix is a Cognito PostConfirmation Lambda
trigger that writes the profile — worth adding if this actually bites.

**Confirmation needs one extra call.** `ConfirmSignUp` confirms by email and
returns nothing about the user, so `AdminGetUser` fetches the `sub` before
updating DynamoDB. A GSI on email would avoid it and cost more moving parts.

There is no local Cognito emulator: `pnpm dev` talks to the real deployed
pool. The auth dependencies are therefore built lazily on first request, not
at route registration, so missing Cognito env vars don't take `/health` and
`/identify` down with them locally.

### Tooling

**Biome replaces ESLint and Prettier.** Not a preference — ESLint could not
lint this codebase at all. `typescript-eslint` declares `typescript <6.1.0` and
throws on import against the TS 7.0 this project uses, so the old config linted
only `.mjs` files and every one of the 35 TypeScript files was unchecked. Biome
parses TypeScript with its own Rust parser and never loads the TS compiler, so
the version is irrelevant to it. It checks the whole project in ~7ms.

Config lives in `biome.json`; `.editorconfig` holds the same indent, line
ending and charset so editors agree with the formatter.

**Hooks (husky).** `pre-commit` runs `lint-staged`, which applies Biome to
staged files only and re-stages the fixes — fast enough to be invisible, and it
blocks the commit on anything unfixable. `pre-push` runs `typecheck` and
`test`, which are too slow to want on every commit but catch problems before
they reach CI.

**CI** (`.github/workflows/ci.yml`) runs `lint`, `typecheck`, `test` and
`test:bundle` on pushes to main and on every PR. It installs with
`--frozen-lockfile` so a stale lockfile fails the build rather than silently
resolving different versions.

### Testing

Two suites, because they catch different things.

`pnpm test` runs `node:test` through tsx over `src/**/*.test.ts`. These are
unit tests with fakes and never touch AWS, so they are fast enough to run on
every save. The use cases take their dependencies as `Pick<CognitoGateway,
"signUp">`-style narrowed types rather than the concrete classes: still bound
to the real signatures, but a plain object satisfies them in a test.

`pnpm test:bundle` builds and then exercises `dist/*.mjs` with synthetic API
Gateway v2 events. This tests the *artifact*, not the source — a missing
`createRequire` banner or an unpackaged shared chunk typechecks perfectly and
still dies at cold start. Both build constraints above were found this way.
It runs with `NODE_ENV=production` so it also guards behaviour that differs
by environment, like validation `details` being present in responses.

### Deployment Workflow

```bash
pnpm sls:deploy       # build + deploy all functions
serverless deploy function -f identify   # fast path: one function's code only
pnpm sls:remove                # tear the stack down — see Data Protection first
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
