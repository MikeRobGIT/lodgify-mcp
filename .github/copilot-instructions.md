# Copilot instructions for lodgify-mcp

Purpose: MCP server exposing Lodgify Public API (v1/v2) as MCP tools. Runs over stdio (default) or Streamable HTTP.

## Big picture architecture
- Entrypoints: `src/server.ts` (stdio MCP), `src/server-http.ts` (HTTP transport).
- Setup: `src/mcp/server-setup.ts` registers tools/resources and lazy-inits the Lodgify client via `getClient()`.
- Orchestrator: `src/lodgify-orchestrator.ts` unifies API modules (`src/api/v1|v2/**`), enforces read-only, and adds aggregates (e.g., vacant inventory).
- Core infra: `src/core/http/**` (fetch wrapper, retry, rate limiter), `src/core/errors/**`, `src/core/retry/**`.
- Tools/resources: grouped by domain in `src/mcp/tools/**`, `src/mcp/resources/**`; shared schemas in `src/mcp/schemas/**`.

## How it works (why this structure)
- Tools call `getClient()` (closure DI) from server setup to avoid globals and simplify tests.
- All HTTP uses `BaseApiClient.request()` for HTTPS-only, rate limiting (sliding window), and retries (max 5; honors Retry-After).
- Read-only safety: POST/PUT/PATCH/DELETE throw `ReadOnlyModeError` early when `LODGIFY_READ_ONLY=1`.
- Complex params use Lodgify bracket notation. Example: `{ "roomTypes[0].Id": 123, "guest_breakdown[adults]": 2 }`.

## Dev workflow (commands)
- Install: `bun install`
- Env: copy `.env.example` → `.env`; set `LODGIFY_API_KEY`. Optional: `LOG_LEVEL`, `DEBUG_HTTP=1`, `LODGIFY_READ_ONLY=1`.
- Run (stdio): `bun dev` (dev) or `bun run build && bun start` (from dist).
- Run (HTTP): `bun run start:http` (requires `MCP_TOKEN`), prod: `bun run start:http:prod`.
- Quality gate: `bun run check` (lint + format + typecheck + build + test).
- Tests: `bun test` (watch: `bun test --watch`, coverage: `bun test --coverage`).

## Conventions to follow
- TypeScript strict; Biome formats/lints. Keep modules ≲ 250 LOC and single-responsibility.
- Validate tool inputs with Zod; put shared shapes in `src/mcp/schemas/**` and add `.describe()` text for fields.
- Use `safeLogger`; never log secrets. Errors are sanitized before returning.
- Dates: tools may include `dateValidation` feedback (warning/error/info) instead of silently fixing dates.

## Add or update a tool (pattern)
1) Create it under `src/mcp/tools/` (right category file). Define a Zod `inputSchema` and a clear `description`.
2) In `handler`, `const client = getClient()` then call orchestrator methods (e.g., `client.properties.listProperties`). Add date feedback if relevant.
3) Export and register it in `src/mcp/tools/register-all.ts` so MCP exposes it.
4) If the orchestrator lacks a method, add it in `src/lodgify-orchestrator.ts` delegating to `src/api/v1|v2/**`.
5) Tests mirror source (add in `tests/mcp/tools/**`) and update `docs/TOOL_CATALOG.md` if user-facing.

Minimal example
- Schema: `const S = z.object({ propertyId: z.string().min(1) })`
- Handler: `const res = await getClient().properties.getProperty(args.propertyId)`
- Register: export in file and include in `register-all.ts`

## Integration points
- Base URL: `https://api.lodgify.com` (HTTPS enforced).
- Tool categories: properties, bookings, availability, rates, quotes, messaging, webhooks, helpers (`docs/TOOL_CATALOG.md`).
- Resource: `lodgify://health` reports ok/version/apiKeyConfigured/timestamp.
- HTTP transport: `POST /mcp` with `Authorization: Bearer <MCP_TOKEN>`; session TTL ~30m (`src/server-http.ts`).

## Files you’ll reference most
- `src/mcp/server-setup.ts` — registries, capabilities, lazy `getClient()`
- `src/mcp/tools/register-all.ts` — where to add tools
- `src/lodgify-orchestrator.ts` — unified API, read-only enforcement, aggregates
- `src/core/http/**` — fetch/retry/rate-limit behavior
- `docs/TOOL_CATALOG.md` — parameters and examples for all tools

## Safety/quality before PR
- `bun run check` passes; tests updated for any tool changes
- No write ops in read-only tests; errors sanitized; no secrets in logs
- If enabling HTTP mode, require `MCP_TOKEN` and document usage in README

Unclear or missing? Tell us what’s confusing and we’ll refine these instructions.