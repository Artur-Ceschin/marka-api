import { rm } from "node:fs/promises";
import * as esbuild from "esbuild";

// One bundle per Lambda. The entry name becomes dist/<name>.mjs, which is
// what sls/functions/*.yml reference as `dist/<name>.handler`.
const functions = ["health", "auth", "identify"];

await rm("dist", { recursive: true, force: true });

await esbuild.build({
  entryPoints: functions.map((name) => `src/main/functions/${name}.ts`),
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",

  // .mjs tells the Lambda Node runtime to load these as ES modules
  // without shipping a package.json alongside them.
  outExtension: { ".js": ".mjs" },

  // Each function is packaged alone via `package.patterns`. With splitting
  // on, esbuild emits a shared chunk that no zip would contain, and every
  // Lambda fails at cold start. Leave this off.
  splitting: false,

  // Bundled CommonJS deps (@fastify/aws-lambda) call require() for node
  // builtins. ESM has no require, so provide a real one.
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },

  logLevel: "info",
});
