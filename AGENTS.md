# Repository Guidelines

## Project Structure & Module Organization
- `src/`: `server.ts` (minimal entry), `lodgify-orchestrator.ts`, `api/{v1,v2}`, `core/*`, `env.ts`, `logger.ts`, `types/`.
- `src/mcp/`: Modular MCP implementation with registry pattern
  - `tools/`: Tool modules organized by category (property, booking, availability, rate, webhook, messaging)
  - `resources/`: Resource registry and implementations
  - `errors/`: Centralized error handling and sanitization
  - `schemas/`: Shared Zod validation schemas
  - `utils/`: TypeScript types and interfaces
  - `server-setup.ts`: Server initialization
- `tests/`: Bun tests (`*.test.ts`). `dist/`: build output. `bin/`: CLI wrapper. Also `docs/`, `examples/`, `scripts/`.

## Build, Test, and Development Commands
- `bun run dev` or `npm run dev`: Run `src/server.ts` with `tsx` for local development.
- `bun run build` or `npm run build`: Type-check and compile to `dist/`.
- `bun test` / `bun test --watch` / `bun test --coverage`: Run unit/integration tests.
- `npm run lint` / `npm run format` / `npm run typecheck`: Lint, format, and TS type-check.
- `bun run check`: Lint (fix), typecheck, format, build, and test in one pass.



## MCP Module Guidelines
- **Registry Pattern**: All tools and resources register through central registries
- **Module Size**: Each module must be <250 lines for maintainability
- **Tool Categories**: property, booking, availability, rate, webhook, messaging
- **Dependency Injection**: Use closure-based `getClient()` pattern, not context passing
- **Error Handling**: All errors go through centralized handler with sanitization
- **Type Safety**: Strong TypeScript types with Zod validation schemas

## Coding Style & Naming Conventions
- Biome (`biome.json`): 2-space indent, 100 cols, LF; single quotes, trailing commas; ESM.
- Names: files `kebab-case`; types/classes `PascalCase`; vars/functions `camelCase`.

## Testing Guidelines
- Bun test; tests in `tests/*.test.ts` mirroring `src/`.
- Favor deterministic tests; mock external HTTP; use coverage for logic changes.

## Commit & Pull Request Guidelines
- Use Conventional Commits (e.g., `feat: ...`, `fix: ...`). Ensure `bun run check` passes before pushing.
- PRs include a clear description, linked issues, and tests; update `README.md`/`docs/` when behavior changes.

## Security & Configuration Tips
- Secrets: Never commit `.env`; use `.env.example` to document variables.
- Required env: `LODGIFY_API_KEY`. Optional: `LOG_LEVEL`, `DEBUG_HTTP`.
- Validate inputs with existing Zod schemas; avoid logging sensitive values.

## Architecture Overview
- `server.ts`: Minimal MCP server entry point, delegates to modular components.
- MCP Modules (`src/mcp/`): Registry-based architecture with 15+ focused modules (<250 lines each)
  - Tool Registry: Centralized tool management with category organization
  - Resource Registry: System monitoring and health checks
  - Error Handler: Secure error processing and sanitization
  - Deprecation System: Graceful API evolution support
- Orchestrator: merges `api/v1` + `api/v2`, auth, retry/rate-limit, query flattening.
- Core: HTTP, errors, rate limiter; `logger.ts` (pino), `env.ts` (Zod). Bin calls `dist/server.js`.

## CI Expectations
- CI on push/PR to `main/master/develop` (Ubuntu + macOS).
- Steps: bun install → lint → bun test (`TEST_MODE=mock`) → build.
- Require: `dist/server.js` and `dist/lodgify-orchestrator.js` present.
- Coverage: uploaded to Codecov.
- Tags `v*`: release workflow publishes to npm with provenance.

## Release Tips
- NPM: `release.yml` publishes on `v*` tags using `NPM_TOKEN`.
- Auto bump/publish: `npm-publish.yml` (push to `main` or manual) needs `RELEASE_PAT` + `NPM_TOKEN`.
- Versioning: Conventional Commits inform bump (major/minor/patch).
- Docker: `docker-publish.yml` pushes multi-arch to `ghcr.io/<owner>/<repo>` (semver + `latest`), auth via `GITHUB_TOKEN`.
- Pull: `docker pull ghcr.io/mikerobgit/lodgify-mcp:latest` or specific version.
