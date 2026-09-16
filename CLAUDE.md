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
  resources/          CloudFormation: S3, DynamoDB, Cognito, SES, custom domain
scripts/              bundle.test.mjs — exercises the built dist/*.mjs artifacts
src/
  applications/       controllers, use cases, Zod schemas
    useCases/<domain>/  one folder per domain, tests colocated
  infra/              external integrations: Cognito, S3, DynamoDB, PlantNet, OpenAI
  kernel/             cross-cutting helpers: AppError, isAwsError, lazy
  main/               composition root
    app.ts            buildApp(plugins) — assembles a Fastify app from a slice
    server.ts         local dev only: every route in one process
    routes/           Fastify plugins, grouped by domain
    plugins/          request hooks — `authenticated` exposes request.user
    factories/        picks concrete implementations and wires them together
    functions/        Lambda entry points — HTTP handlers plus cognitoTriggers.ts
  shared/             env validation (+ requireEnv), logger, domain types
```

Dependencies point inward: `main` knows everything, `applications` knows
`shared` and `infra` interfaces, `shared` knows nothing.

### Key Design Principles

- **Route Modules**: Each feature/domain gets a route file that exports a Fastify plugin
- **Environment Validation**: Zod schema in `shared/env.ts` validates all env vars at startup—fail fast
- **Type Safety**: Strict TypeScript settings (noUncheckedIndexedAccess, exactOptionalPropertyTypes) enforced to catch bugs early
- **No Over-Engineering**: Add abstractions only when you have 3+ similar cases; premature abstractions slow learning
- **No `utils/` folder**: shared helpers live beside the concern they serve — `requireEnv` next to the env schema, `isAwsError` and `lazy` in `kernel/` — so nothing becomes a grab bag

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
pnpm sls:print        # Resolved config — PRINTS SSM SECRETS IN PLAINTEXT; always pipe through grep
pnpm sls:remove       # Delete the stack (fails until deletion protection is off)

# Environment
# Copy .env.example to .env (pnpm dev loads it). Blank API keys fall back to fixtures.
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

Marka API is **three HTTP functions behind one API Gateway HTTP API**, plus
**two Cognito trigger functions** that Cognito invokes directly. There are no
servers, no load balancer, and no VPC — the whole stack costs ~$0/month at low
traffic and stays inside the Lambda free tier.

```
Internet -> API Gateway (HTTP API)
              |-- health    GET  /health, /status              128MB /  5s
              |-- auth      POST /auth/*                       256MB / 10s
              |-- identify  POST /uploads, /identify,         1024MB / 29s
                                 /detections/{id}/confirm
                            GET  /identifications
                              |-- S3 (plant images)
                              |-- DynamoDB (detections, daily usage)
                              |-- PlantNet (identify), OpenAI (enrich)

Cognito -> postConfirmation   256MB / 5s   writes the UsersTable profile
        -> preSignUp          256MB / 5s   links Google to an existing account
```

### Why Split Into Three HTTP Functions?

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
- **No `binaryMimeTypes` anywhere now.** It was required while `identify`
  accepted multipart uploads — without it API Gateway's base64 body reached
  Fastify as a string and `toBuffer()` yielded garbage. Images now go straight
  to S3, so the functions only ever see JSON. Reintroduce it if a route ever
  accepts a binary body again.

### Known Limits

- API Gateway HTTP API has a **hard 29-second request timeout**.
- Lambda's synchronous payload limit is **6MB** (API Gateway allows 10MB).
  Phone photos exceed this, which is why uploads go straight to S3 via a
  presigned POST — see "Uploads" below.

### Uploads: presigned POST

Images never pass through Lambda. The client asks for a presigned upload,
sends the file straight to S3, then sends only the key:

```
POST /uploads    { contentType }  -> { url, fields, key, maxBytes, expiresIn }
  client POSTs the file to `url` with `fields` + the file, direct to S3
POST /identify   { key, location } -> the detection
```

This is what removes the **6MB Lambda payload limit** — phone photos routinely
exceed it, and base64 encoding over API Gateway inflates them by a further
third. It also keeps the upload out of the 29-second API Gateway timeout and
stops the function paying memory to buffer an image.

**Presigned POST, not PUT.** Only POST carries policy conditions, and
`content-length-range` is the only thing that actually caps upload size — a
presigned PUT will accept a 5GB file from an authenticated caller and there is
no server-side way to refuse it. The tradeoff is a slightly heavier client: it
must send `multipart/form-data` containing every field from `fields` *before*
the file part, in that order.

**The key proves its own ownership.** Keys are `uploads/<userId>/<uuid>`, so
`assertOwnedBy` rejects another user's key before any S3 or PlantNet call.
This matters because `/identify` accepts a key from the client — without the
check, user A could pass user B's key and pull their image into a detection.
The mismatch answers 404 rather than 403: confirming a key exists but belongs
to someone else is itself a leak. The uuid keeps keys unguessable, so knowing
a user id is not enough to reach their uploads.

`getObject` doubles as the upload check: a key that was never uploaded to fails
with a 404 before a quota credit or a PlantNet call is spent on it.

**The bucket needs CORS** or browser uploads fail at the pre-flight; native
mobile clients ignore CORS entirely, so this is easy to miss until the web
client exists. Lifecycle rules expire `uploads/` after 7 days — a presigned URL
can be issued and used but never identified, leaving objects that are
unreachable and still billed — and abort incomplete multipart uploads after 1
day, which are invisible in the console but charged.

### The identification flow

Identification is split across two requests because the **user** is the one
who resolves ambiguity — they are standing in front of the plant:

```
POST /uploads                          -> presigned POST
  client uploads the image to S3
POST /identify { key, location }       -> PlantNet only     ~1-3s
  -> { detectionId, candidates: [{species, confidence}...],
       status: "pending_confirmation" }
  user picks a candidate in the UI
POST /detections/{id}/confirm { species } -> LLM only       ~5-15s
  -> { species, enrichment: {description, care, toxicity, nativeStatus} }
```

**Enrichment runs only after confirmation.** Enriching every candidate would
multiply cost and discard most of it, but the real reason is that enrichment
includes toxicity advice — generating "safe around cats" for a species nobody
confirmed produces confident, wrong answers about something that matters.

Both timings are estimates: neither call has been measured end to end against
the real services yet, and that measurement is what decides whether the
synchronous design holds.

The split also keeps both calls well inside API Gateway's 29-second ceiling,
which is what makes a synchronous design viable at all. If either half grows
past it, the fix is an explicit job (`202` + a poll endpoint), **not** an S3
event trigger: an S3 event has no HTTP request to answer, so the client would
need polling anyway, and it would bypass the ownership and upload checks that
`/identify` performs.

**PlantNet identifies; the LLM explains.** These are not interchangeable. A
general vision model returns a confident, plausible, wrong binomial — species
ID is where a specialised model trained on labelled plant images beats a
generalist. The LLM's value is everything PlantNet does not return:
description, care, toxicity, and native or invasive status.

**PlantNet does not take coordinates.** `lat` and `lon` query parameters are
rejected outright (`"lat" is not allowed`), and because the gateway maps any
PlantNet 400 to `INVALID_IMAGE`, the failure first looked like a bad photo.
Regional narrowing is done by project instead — `PLANTNET_PROJECT=weurope` or
`canada` rather than `all`. The request's `location` is stored on the detection
and read by exactly one consumer: enrichment's native/invasive answer, so only
`/identify` needs to receive it. Clients should prefer the photo's EXIF GPS over
live device location — a gallery or holiday photo was not taken where the user
is standing now — and round to about two decimal places, since native status
is regional and full precision pinpoints a user's garden.

Enrichment runs on **`gpt-5-nano`** (`infra/gateways/enrichment.ts`), chosen on
cost: roughly $0.0004 per enrichment against $0.026 on a frontier model, on a
task that is factual recall and formatting rather than reasoning. Two things
that choice depends on:

- **`reasoning: { effort: "minimal" }` is not optional.** Nano is a reasoning
  model and reasoning tokens bill as output tokens, so leaving effort at its
  default would spend the saving the model was picked for.
- **Toxicity is the field to watch.** It is the one output where a confident
  hallucination causes real harm, and smaller models are worse at knowing when
  they do not know. The system prompt tells it to defer to a vet when unsure;
  before trusting it at volume, run an eval of known-toxicity species against
  a larger model and compare.

The gateway is one file with one method, so swapping providers is a contained
change — that is why the model choice was not worth agonising over up front.

**`/confirm` rejects a species that was not among the candidates.** Without
that check the endpoint is a free "write care instructions for anything" call,
and the stored detection would claim an identification that never happened.

Both gateways fall back to fixtures when their API key is absent, logging a
warning, so the whole flow is exercisable locally. `PLANTNET_API_KEY` and
`OPENAI_API_KEY` come from SSM at deploy time (`/marka/<stage>/...`), so
they are never committed — note they are resolved into the function's
environment, which is not the same as reading Secrets Manager at runtime.

### Daily identification quota

Each user gets `DAILY_IDENTIFY_LIMIT` identifications per UTC day, enforced in
`infra/repositories/usageRepository.ts`. It is set to **10** in
`sls/config/provider.yml`; the Zod default of 5 only applies locally when the
variable is unset. PlantNet's free tier is 500 identifications a day **shared
across every user**, so 10 per user covers about 50 daily-active users before
the shared pool runs dry. Past that, raise the variable and upgrade the PlantNet
plan — nothing else changes. `/identify` returns
`quota: { used, limit, remaining }` so the client can show what is left, and the
first call over the limit returns `429 DAILY_LIMIT_REACHED`.

**The check is one conditional `UpdateItem`, not a read followed by a write.**
Two concurrent requests would both read 4, both conclude there was room, and
both proceed. DynamoDB evaluates `ConditionExpression` and the increment
together, so the second fails with `ConditionalCheckFailedException` — which
the repository maps to a 429 rather than letting it surface as a 500.

`UsageTable` is keyed `userId` + `day`, so a new day is simply a new row and
the counter never needs resetting; TTL removes yesterday's. Storing one row
per user with a date attribute instead would need read-modify-write logic to
detect the rollover. These rows are disposable counters, which is why this is
the one table with no `Retain` and no deletion protection.

**The credit is claimed before PlantNet is called**, so a failed
identification still costs the user one. That is the right way round — the
quota protects a shared allowance, and claiming after success lets a burst of
retries blow straight through it.

Days are bucketed in **UTC**, so everyone's quota resets at the same instant
rather than at a time that depends on where they are.

### Per-User Detections

`DetectionsTable` is keyed `userId` (HASH) + `detectionId` (RANGE), not a bare
`id`. The key is the physical layout in DynamoDB, not an indexed column: the
partition key decides which partition an item lives on. Keyed on a random `id`,
every detection scatters and "this user's detections" can only be answered by a
`Scan` — reading the whole table and discarding non-matches, at a cost that
grows with the table rather than the result. Keyed on `userId`, one user's rows
share a partition and a `Query` reads only them.

That also makes isolation structural: a `Query` is scoped to one partition key,
so it cannot return another user's rows even if a caller supplies a bad cursor.

`detectionId` is `<ISO-8601 timestamp>#<random suffix>`. Sort keys order
lexicographically and ISO-8601 sorts chronologically as text, so newest-first
is `ScanIndexForward: false` with no sorting in code; the suffix prevents
collisions inside one millisecond.

**Changing this key schema later is a migration**, not a config edit — it
requires replacing the table, which collides with `DeletionProtectionEnabled`,
`UpdateReplacePolicy: Retain`, and the explicit `TableName`. It was free here
only because the table held zero items.

### Reading the caller's identity

All four identify-domain routes — `/uploads`, `/identify`,
`/detections/{id}/confirm`, `/identifications` — sit behind the API Gateway JWT
authorizer,
which validates the token at the edge and passes the claims through at
`request.awsLambda.event.requestContext.authorizer.jwt.claims`. **A Lambda
authorizer is not needed** — it would add a function, a cold start and a bill
to re-verify what API Gateway already verified. Lambda authorizers earn their
place only for logic API Gateway cannot express: database lookups, API keys,
non-JWT tokens.

`main/plugins/authenticated.ts` normalises this into `request.user`. In Lambda
it trusts the edge-verified claims; locally, where there is no API Gateway, it
verifies the bearer token with `aws-jwt-verify`. Handlers therefore never
branch on environment, and `pnpm dev` behaves like production.

### Data Protection

The detections and users tables carry three separate protections, because they
fail in different ways (the usage table deliberately has none — its rows are
disposable counters):

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

**The S3 bucket has `Retain` but no versioning.** It survives a stack deletion,
but a deleted or overwritten object is gone.

**Detection images live under `detections/`, not `uploads/`.** The
`expire-unidentified-uploads` lifecycle rule deletes `uploads/` after 7 days —
right for an upload nobody identified, wrong for an image a detection points
at. So once PlantNet succeeds, `/identify` copies the object to
`detections/<userId>/<id>` (`PlantBucket.persist`) and stores that as
`imageKey`. It copies rather than moves, because the lifecycle rule already
removes the original and a delete would need another permission; and it copies
only after identification succeeds, so a failed call leaves nothing durable.

### IAM

One role shared by all five functions, scoped to the specific bucket and table
ARNs — with one exception. The Cognito statement grants
`arn:aws:cognito-idp:<region>:<account>:userpool/*` instead of
`!GetAtt UserPool.Arn`, because the GetAtt is circular: the pool's
`LambdaConfig` references the trigger functions, and those functions use this
role. The account and region hold exactly one pool, so it grants nothing extra
in practice. Per-function roles (the `serverless-iam-roles-per-function` plugin)
would let the main role keep the tight ARN; not worth adding until a second pool
exists or a function handles data the others should not touch.

The role also holds `s3:ListBucket` on the bucket. Without it S3 answers
`GetObject` on a missing key with `403 Access Denied` rather than
`404 NoSuchKey`, so a never-uploaded key would surface as a 500 instead of a
clean `UPLOAD_NOT_FOUND`. The role can already read every object, so listing
keys grants nothing meaningful.

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
POST /auth/signout          -> {refreshToken} -> 204, revoked at Cognito
GET  /me                    -> the UsersTable profile (JWT authorizer)
```

**`/auth/signout` takes no bearer token.** It must work after the id token
has expired, and holding the refresh token is authority enough to revoke it.
It calls Cognito `RevokeToken`, which needs no IAM permission and requires
`EnableTokenRevocation` on the client (set explicitly in `cognito.yml`, even
though it is the default, because sign-out silently depends on it). It is
per-device: only that refresh token and the tokens issued from it die.
An already-revoked token answers 204, so a double sign-out is not an error;
revocation being disabled is *not* swallowed, since that would report a
sign-out while the token kept working. **Id tokens already issued stay valid
at API Gateway until they expire (up to 1 hour)** — the JWT authorizer checks
signature and expiry, never Cognito, so revocation cannot reach them.

**`/me` repairs a missing profile.** `postConfirmation` never blocks sign-in
on a failed write, so a signed-in user can have no row. `/me` rebuilds it
from the edge-verified `sub` and `email` claims with the same conditional put,
instead of returning a 404 the client cannot act on. It is also the quickest
check that Google linking worked: signing in both ways must return the same
`userId`.

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

**The profile row is written by the `postConfirmation` trigger.** Cognito fires
it for native confirmation and for a federated user's first sign-in, and Google
users never call `/auth/signup`, so a profile written only by `SignUpUseCase`
would never exist for them. `SignUpUseCase` still writes the row too — the write
is conditional on `attribute_not_exists(userId)`, so the two are idempotent —
and that write can come out once the trigger has been verified with a real
sign-up.

**Confirmation needs one extra call.** `ConfirmSignUp` confirms by email and
returns nothing about the user, so `AdminGetUser` fetches the `sub` before
updating DynamoDB. A GSI on email would avoid it and cost more moving parts.

There is no local Cognito emulator: `pnpm dev` talks to the real deployed
pool. The auth dependencies are therefore built lazily on first request, not
at route registration, so missing Cognito env vars don't take `/health` and
`/identify` down with them locally.

### Google sign-in

Google is a **second, parallel auth flow**, not an extra button on the first.
Cognito's docs are explicit: *"You can't sign in federated users with the Amazon
Cognito user pools API."* `/auth/signin` can never serve a Google user. The
client redirects the browser to Cognito's authorize endpoint with
`identity_provider=Google`, receives a `code` on its callback route, and
exchanges it at `/oauth2/token` with PKCE. The app client has no secret, so PKCE
— not secrecy of the client id, which necessarily ships in the browser — is what
protects that exchange.

What that requires in `sls/resources/cognito.yml`:

- **A Cognito domain** (`marka-auth-<stage>`). It hosts `/oauth2/authorize` and
  `/oauth2/token` even though no Cognito page is ever rendered — the app has its
  own login UI.
- **OAuth on the app client**: the `code` grant, `openid email profile`, and a
  `CallbackURLs` allow-list in `sls/config/custom.yml`. Cognito matches
  `redirect_uri` exactly — scheme, port and trailing slash.
- **`GoogleIdentityProvider`**, with the Google client id and secret from SSM
  (`/marka/<stage>/google-client-id` and `/google-client-secret`).
- **`AttributeMapping` for `email` and `email_verified`.** Without it a Google
  user arrives with no address, and both triggers have nothing to key on.
- **`DependsOn: GoogleIdentityProvider` on the app client.** The client names
  `Google` in `SupportedIdentityProviders`, and CloudFormation cannot infer an
  ordering from a plain string.

**There are two redirect lists, and only one contains localhost.** Google's
authorized redirect URI is always Cognito's `https://<domain>/oauth2/idpresponse`
— Google redirects to Cognito, never to the app. The app's own URLs, localhost
included, belong in Cognito's `CallbackURLs`. The domain is stage-scoped, so a
`prod` stage needs a second entry in Google's list.

Both flows end with an **`idToken`**, so everything downstream — the JWT
authorizer, `/auth/refresh`, the quota — is identical and cannot tell them apart.

#### Cognito triggers

`src/main/functions/cognitoTriggers.ts` holds two handlers in one bundle. Both
must answer within **5 seconds**, and Cognito treats an error or a timeout as a
failed sign-in, so each does the minimum and never throws for anything
recoverable.

- **`postConfirmation`** writes the `UsersTable` profile. It fires for native
  confirmation *and* a federated user's first sign-in, which is why the write
  lives here. It ignores `PostConfirmation_ConfirmForgotPassword`.
- **`preSignUp`** links a Google sign-in to an existing password account with
  the same email, so one person is one `sub` rather than two users with two sets
  of detections. `DestinationUser` must be the pool **username**, which with
  email sign-in is a UUID rather than the address, so the account is found with
  `ListUsers` first. It links only when `email_verified` is `"true"`: linking
  lets the external identity sign in *as* the account, so an unverified email
  there is an account takeover. A failed link is logged and sign-in proceeds.
  **Linking has not been verified end to end yet** — sign in with Google as an
  address that already has a password account and confirm Cognito shows one
  user.

**Wiring the triggers hit two CloudFormation circular dependencies**, and
neither was caught by typecheck, tests or `sls:print`:

- **`provider.environment` applies to every function**, triggers included.
  `USER_POOL_ID: !Ref UserPool` there made the trigger functions depend on the
  pool that depends on them through `LambdaConfig`. The pool variables are now
  set per function on `auth` and `identify`; the triggers read `userPoolId` from
  the event.
- **The shared IAM role referenced `!GetAtt UserPool.Arn`** — see IAM above.

`sls:print` resolves variables but never validates the template's dependency
graph. `serverless package` writes the real template to
`.serverless/cloudformation-template-update-stack.json` without deploying, and
that file can be checked for cycles locally. From the same round: resources
appended to the end of a CloudFormation file that finishes with an `Outputs:`
block silently become outputs rather than resources.

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
by environment, like validation `details` being present in responses. It also
imports `cognitoTriggers.mjs`, asserts both handlers are exported, and checks
each passes through trigger sources it does not own — a failed import there is
a failed sign-in, not a failed request.

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
