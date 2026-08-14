# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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
- **Build**: tsup (esbuild wrapper for fast TypeScript bundling)

### High-Level Structure
```
src/
  ├── server.ts         # Entry point, server startup
  ├── app.ts            # Fastify app setup, route registration
  ├── routes/           # Route handlers (modular by domain)
  └── utils/            # Shared utilities (env validation, helpers)
```

### Key Design Principles
- **Route Modules**: Each feature/domain gets a route file that exports a Fastify plugin
- **Environment Validation**: Zod schema in `utils/env.ts` validates all env vars at startup—fail fast
- **Type Safety**: Strict TypeScript settings (noUncheckedIndexedAccess, exactOptionalPropertyTypes) enforced to catch bugs early
- **No Over-Engineering**: Add abstractions only when you have 3+ similar cases; premature abstractions slow learning

## Development Commands

```bash
# Development
pnpm dev              # Run with tsx watch (hot reload on src changes)

# Build & Run
pnpm build            # Compile TypeScript to dist/ via tsup
pnpm start            # Run compiled server from dist/

# Linting
pnpm exec eslint .    # Run ESLint on all TS files

# Environment
# Copy .env.example to .env and populate (PORT, NODE_ENV, etc.)
```

## Important Patterns

### Adding Routes
Routes are Fastify plugins in `src/routes/`. Register them in `app.ts`:
```typescript
// routes/plants.ts
import { FastifyInstance } from "fastify";

export async function plantRoutes(app: FastifyInstance) {
  app.post("/detect", async (request) => {
    // Handler
  });
}

// app.ts
import { plantRoutes } from "@/routes/plants";
app.register(plantRoutes);
```

### Environment Variables
Define in `utils/env.ts` as a Zod schema. This validates at startup and provides typed access throughout the app.

### Runtime Validation
Use Zod for request bodies, query params, and responses. This ensures API contracts are enforced at the boundary.

## Learning Notes for Future Work

This is a teaching project as much as a product. When making decisions:
- **Prioritize clarity over cleverness.** A simple approach that can be explained in 2 sentences beats a "clever" pattern.
- **Ask "why does this work?" not just "does it work?"** Understand what PlantNet returns, how geolocation improves results, why certain AI models are chosen.
- **No "vibe code."** Every design decision should have a clear reason tied to either performance, maintainability, or learning a specific concept.
- **Avoid speculative abstractions.** Only refactor when shipping the same pattern for the 3rd time.

## Deployment Target
Fast enough to deploy—likely serverless (Vercel, Lambda). Keep bundle size reasonable and avoid heavy dependencies.

## AI/ML Integration Notes
When integrating PlantNet API and AI models:
- Document the API contract and what each field means
- Add type-safe schemas for API responses (Zod)
- Include comments on *why* certain model choices or parameters were made (helps learning)
- Test edge cases (poor photo quality, location accuracy, rare plants)
