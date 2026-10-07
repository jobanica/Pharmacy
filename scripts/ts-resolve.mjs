/**
 * Module resolution for `node --test`, so the test files can import the app's
 * TypeScript directly.
 *
 * Node 22 strips types from .ts files on its own, but it still resolves like
 * ESM: an extensionless `./signing` or a `@/lib/...` alias is not a file. This
 * hook fills both gaps — the same two things tsconfig and the bundler do — so
 * no test framework or build step is needed to run the suite.
 *
 * Used as: node --import ./scripts/ts-resolve.mjs --test tests/*.test.ts
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";

const root = pathToFileURL(`${process.cwd()}/`).href;

export async function resolve(specifier, context, next) {
  // "@/lib/x" → <repo root>/lib/x, matching tsconfig's path alias.
  let spec = specifier.startsWith("@/") ? new URL(specifier.slice(2), root).href : specifier;

  try {
    return await next(spec, context);
  } catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
    // Extensionless relative/absolute import: try .ts, then .tsx, then /index.ts.
    const base = spec.startsWith(".") ? new URL(spec, context.parentURL).href : spec;
    for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
      if (existsSync(new URL(candidate))) return next(candidate, context);
    }
    throw error;
  }
}

register(import.meta.url);
