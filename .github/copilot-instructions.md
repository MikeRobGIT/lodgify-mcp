
# Copilot Instructions for lodgify-mcp

This project is a Model Context Protocol (MCP) server that exposes Lodgify Public API v1/v2 as MCP tools for AI agents. It is designed for modularity, testability, and safe automation.

## Architecture Overview
- **Entrypoints:**
	- `src/server.ts` (stdio MCP server)
	- `src/server-http.ts` (HTTP transport)
- **Server Setup:**
	- `src/mcp/server-setup.ts` registers all tools/resources and provides `getClient()` for orchestrator access (closure DI, no globals).
- **Orchestrator:**
	- `src/lodgify-orchestrator.ts` unifies v1/v2 API modules, enforces read-only mode, and provides aggregate endpoints (e.g., vacant inventory).
- **Core Infrastructure:**
	- `src/core/http/` (fetch wrapper, retry, rate limiter)
	- `src/core/errors/`, `src/core/retry/` (centralized error handling)
- **Tools & Resources:**
	- Grouped by domain in `src/mcp/tools/` and `src/mcp/resources/`
	- Shared Zod schemas in `src/mcp/schemas/`
- **Testing:**
	- Tests mirror source structure in `tests/` (see `tests/mcp/tools/` for tool tests)

## Key Patterns & Conventions
- **Dependency Injection:** Always use `getClient()` from server setup for orchestrator access—never import singletons.
- **HTTP Layer:** All requests go through `BaseApiClient.request()` (enforces HTTPS, sliding window rate limiting, up to 5 retries, honors `Retry-After`).
- **Read-Only Mode:** All write operations (POST/PUT/PATCH/DELETE) throw `ReadOnlyModeError` if `LODGIFY_READ_ONLY=1` is set.
- **Parameter Notation:** Use Lodgify bracket notation for complex params (e.g., `{ "roomTypes[0].Id": 123 }`).
- **Validation:** All tool inputs must use Zod schemas, with shared shapes in `src/mcp/schemas/` and `.describe()` for fields.
- **Logging:** Use `safeLogger` (never log secrets). Errors are sanitized before returning to clients.
- **Date Handling:** Tools may return `dateValidation` feedback (warning/error/info) instead of auto-fixing dates.
- **Module Size:** Keep modules ≤250 LOC and single-responsibility.

## Developer Workflow
- **Install:** `bun install`
- **Environment:** Copy `.env.example` → `.env`, set `LODGIFY_API_KEY`. Optional: `LOG_LEVEL`, `DEBUG_HTTP=1`, `LODGIFY_READ_ONLY=1`.
- **Run (stdio):** `bun dev` (dev) or `bun run build && bun start` (from dist)
- **Run (HTTP):** `bun run start:http` (requires `MCP_TOKEN`), prod: `bun run start:http:prod`
- **Quality Gate:** `bun run check` (lint + format + typecheck + build + test)
- **Tests:** `bun test` (watch: `bun test --watch`, coverage: `bun test --coverage`)

## Tool Implementation Example
1. Create tool in `src/mcp/tools/[category]-tools.ts` with Zod `inputSchema` and clear `description`.
2. In handler: `const client = getClient()`; call orchestrator methods (e.g., `client.properties.listProperties`).
3. Register tool in `src/mcp/tools/register-all.ts`.
4. If orchestrator lacks a method, add it in `src/lodgify-orchestrator.ts` (delegate to `src/api/v1|v2/**`).
5. Add/modify tests in `tests/mcp/tools/` and update `docs/TOOL_CATALOG.md` if user-facing.

**Minimal Example:**
- Schema: `const S = z.object({ propertyId: z.string().min(1) })`
- Handler: `const res = await getClient().properties.getProperty(args.propertyId)`
- Register: export in file and include in `register-all.ts`

## Integration Points
- **API Base:** `https://api.lodgify.com` (HTTPS enforced)
- **Tool Categories:** properties, bookings, availability, rates, quotes, messaging, webhooks, helpers (see `docs/TOOL_CATALOG.md`)
- **Resource:** `lodgify://health` (system status)
- **HTTP Transport:** `POST /mcp` with `Authorization: Bearer <MCP_TOKEN>`; session TTL ~30m

## Critical Files & References
- `src/mcp/server-setup.ts` — tool/resource registration, orchestrator DI
- `src/mcp/tools/register-all.ts` — tool registry
- `src/lodgify-orchestrator.ts` — unified API, read-only, aggregates
- `src/core/http/` — fetch/retry/rate-limit
- `docs/TOOL_CATALOG.md` — tool parameters/examples
- `tests/` — test strategy and coverage

## Error Handling & Rate Limiting
- All errors are processed through centralized handlers and sanitized.
- Rate limiting uses a sliding window; 429s honor `Retry-After` or exponential backoff (max 30s, 5 attempts).

## Security
- API keys only from environment variables; never log secrets or PII.
- Mask sensitive fields in logs/errors.

---
If any section is unclear or incomplete, please provide feedback for further refinement.