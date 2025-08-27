# Repository Guidelines

## Project Structure & Module Organization
- `src/`: `server.ts` (MCP), `lodgify-orchestrator.ts`, `api/{v1,v2}`, `core/*`, `env.ts`, `logger.ts`, `types/`.
- `tests/`: Bun tests (`*.test.ts`). `dist/`: build output. `bin/`: CLI wrapper. Also `docs/`, `examples/`, `scripts/`.

## Build, Test, and Development Commands
- `bun run dev` or `npm run dev`: Run `src/server.ts` with `tsx` for local development.
- `bun run build` or `npm run build`: Type-check and compile to `dist/`.
- `bun test` / `bun test --watch` / `bun test --coverage`: Run unit/integration tests.
- `npm run lint` / `npm run format` / `npm run typecheck`: Lint, format, and TS type-check.
- `bun run check`: Lint (fix), typecheck, format, build, and test in one pass.



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
- `server.ts`: MCP server wiring (tools/resources, Zod validation).
- Orchestrator: merges `api/v1` + `api/v2`, auth, retry/rate-limit, query flattening.
- Core: HTTP, errors, rate limiter; `logger.ts` (pino), `env.ts` (Zod). Bin calls `dist/server.js`.

## CI Expectations
- CI on push/PR to `main/master/develop` (Ubuntu + macOS).
- Steps: bun install → lint → bun test (`TEST_MODE=mock`) → build.
- Require: `dist/server.js` and `dist/lodgify.js` present.
- Coverage: uploaded to Codecov.
- Tags `v*`: release workflow publishes to npm with provenance.

## Release Tips
- NPM: `release.yml` publishes on `v*` tags using `NPM_TOKEN`.
- Auto bump/publish: `npm-publish.yml` (push to `main` or manual) needs `RELEASE_PAT` + `NPM_TOKEN`.
- Versioning: Conventional Commits inform bump (major/minor/patch).
- Docker: `docker-publish.yml` pushes multi-arch to `ghcr.io/<owner>/<repo>` (semver + `latest`), auth via `GITHUB_TOKEN`.
- Pull: `docker pull ghcr.io/mikerobgit/lodgify-mcp:latest` or specific version.
