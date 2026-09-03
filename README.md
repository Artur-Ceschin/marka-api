# Marka API

Plant detection API. Identifies plants from a photo (and optional
coordinates) using PlantNet and AI models.

Runs as **three AWS Lambda functions behind one API Gateway HTTP API**.

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm dev              # every route in one process on :3333
```

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Local server, all routes, hot reload |
| `pnpm build` | Bundle each handler to `dist/*.mjs` |
| `pnpm invoke` | Run the built bundles against synthetic API Gateway events |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm sls:deploy` | Build, then deploy all functions |
| `pnpm sls:logs identify` | Tail one function's CloudWatch logs |
| `pnpm sls:remove` | Delete the whole stack from AWS |

## Layout

```
sls/                  Serverless config, split by concern
  config/             provider + shared variable definitions
  functions/          one file per deployed function
  resources/          CloudFormation for S3 and DynamoDB
scripts/              local tooling (synthetic Lambda invocation)
src/
  applications/       controllers, use cases, Zod schemas
  infra/              external integrations (PlantNet, S3) — currently mocked
  kernel/             cross-cutting concerns (error handling)
  main/               composition root: app, server, routes, Lambda entry points
  shared/             env validation, logger, domain types
```

## Endpoints

| Method | Path | Function | Status |
|---|---|---|---|
| GET | `/health`, `/status` | health | ✅ |
| POST | `/auth/signup`, `/auth/signin` | auth | validated, returns 501 |
| POST | `/identify` | identify | ✅ (services mocked) |

## Custom domain

`https://api.markaplant.app` — see the *Custom Domain* section in `CLAUDE.md`.
DNS is in **Cloudflare**; the Route53 zone for `markaplant.app` is orphaned.

## Notes

`pnpm sls:deploy` pins `AWS_PROFILE=marka`. This is deliberate — Serverless
resolves `${aws:*}` variables through the default credential chain *before*
`provider.profile` is applied, and the default profile here points at a
different AWS account.

`pnpm lint` covers `.mjs` files only. typescript-eslint does not support
TypeScript 7 yet, and ESLint cannot parse TypeScript without it — so type
safety rests on `pnpm typecheck` (strict `tsc`) for now. See the comment in
`eslint.config.mjs` for how to re-enable TS linting.

See `CLAUDE.md` for architecture rationale and build constraints.
