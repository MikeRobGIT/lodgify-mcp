# Product Requirements Document (PRD)

**Product**: Lodgify MCP Server
**Working Directory**: `lodgify-mcp`
**Owner**: Mike (SE)
**Version**: v0.1 (Initial)
**Last Updated**: 2025-08-13

---

## 1) Summary

Build a Model Context Protocol (MCP) server that exposes key Lodgify Public API v2 endpoints as MCP tools. This enables AI assistants and MCP‑aware IDEs to discover inventory, manage bookings, generate quotes, and retrieve availability/rates programmatically with standardized tool interfaces.

**One‑liner**: “Operate Lodgify (v2) via MCP tools.”

---

## 2) Goals & Non‑Goals

### Goals

* Provide a production‑ready MCP server implementing a curated set of Lodgify v2 endpoints.
* Make common tasks—listing properties, fetching availability, generating quotes, reading/updating bookings—trivial to orchestrate from AI agents.
* Offer strong error handling (429 backoff, structured errors), minimal configuration, and clean JSON outputs.
* Ship clear examples and a test harness so Task Master AI can generate sub‑tasks and validations.

### Non‑Goals (v0.1)

* Implement Lodgify v1 endpoints (e.g., webhooks) — consider for a later release.
* Build a persistent DB/cache layer (beyond in‑memory rate/backoff state).
* Provide a GUI. (Consumers are MCP clients or programmatic runners.)

---

## 3) Users & Use Cases

**Primary user**: Developers/agents integrating Lodgify data/actions into workflows (scheduling, quoting, ops dashboards).

**Representative use cases**

* AI agent composes an itinerary: checks property availability, retrieves daily rates, produces a quote, generates a payment link for a booking.
* Ops assistant lists bookings filtered by date range/status; pulls a single booking and updates key codes.
* Support agent inspects a messaging thread by GUID.

---

## 4) Assumptions & Constraints

* Access to a valid **Lodgify API key** with the necessary scopes.
* We will always call `https://api.lodgify.com` (no override).
* Execution environment: Node.js ≥ 18, network egress to Lodgify.
* Rate limiting exists; we must gracefully handle HTTP 429 with `Retry-After`.

---

## 5) Scope (v0.1)

### Endpoints wrapped as MCP tools

* **Properties**

  * `lodgify.list_properties` → GET `/v2/properties`
  * `lodgify.get_property` → GET `/v2/properties/{id}`
  * `lodgify.list_property_rooms` → GET `/v2/properties/{id}/rooms`
  * `lodgify.list_deleted_properties` → GET `/v2/deletedProperties`
* **Rates**

  * `lodgify.daily_rates` → GET `/v2/rates/calendar`
  * `lodgify.rate_settings` → GET `/v2/rates/settings`
* **Reservations / Bookings**

  * `lodgify.list_bookings` → GET `/v2/reservations/bookings`
  * `lodgify.get_booking` → GET `/v2/reservations/bookings/{id}`
  * `lodgify.get_booking_payment_link` → GET `/v2/reservations/bookings/{id}/quote/paymentLink`
  * `lodgify.create_booking_payment_link` → POST `/v2/reservations/bookings/{id}/quote/paymentLink`
  * `lodgify.update_key_codes` → PUT `/v2/reservations/bookings/{id}/keyCodes`
* **Availability**

  * `lodgify.availability_room` → GET `/v2/availability/{propertyId}/{roomTypeId}`
  * `lodgify.availability_property` → GET `/v2/availability/{propertyId}`
* **Quotes & Messaging**

  * `lodgify.get_quote` → GET `/v2/quote/{propertyId}` (supports bracket‑notation query arrays)
  * `lodgify.get_thread` → GET `/v2/messaging/{threadGuid}`

**Resources**

* `lodgify-health` read‑only resource (`lodgify://health`) for connectivity meta.

---

## 6) Success Metrics

* **Functional**: 100% of listed tools return expected shapes for happy‑path inputs.
* **Resilience**: 429s retried up to 5 attempts with exponential backoff + `Retry-After` when present; <1% tool calls fail due to transient 429 under typical usage.
* **DX**: “Time‑to‑first‑tool” < 5 minutes using README and examples.
* **Quality**: ≥ 90% unit test coverage for client; integration smoke tests for each tool.

---

## 7) Architecture Overview

* **Transport**: MCP over stdio.
* **Server**: TypeScript + `@modelcontextprotocol/sdk`.
* **HTTP Client**: Thin wrapper around `fetch` with query flattener (bracket‑notation), JSON handling, and 429 retry.
* **Config**: `.env` with `LODGIFY_API_KEY` and optional `LOG_LEVEL`.
* **Logging**: Console (JSON lines), levels: error | warn | info | debug. (Env: `LOG_LEVEL`.)

---

## 8) Directory Structure

```
lodgify-mcp/
├─ package.json
├─ tsconfig.json
├─ .env.example
├─ README.md
└─ src/
   ├─ server.ts          # MCP server & tool registrations
   └─ lodgify.ts         # HTTP client and endpoint wrappers
```

---

## 9) Functional Requirements

### FR‑1: Authentication

* All outbound Lodgify requests set `X-ApiKey: <LODGIFY_API_KEY>` header.
* Server fails fast at startup if `LODGIFY_API_KEY` missing.

### FR‑2: Tool Contracts (Inputs/Outputs)

Each tool exposes **input schema** and returns serialized JSON from Lodgify (pass‑through), wrapped in MCP `{ content: [{ type: "json", json }] }`.

**Examples (abridged)**

* `lodgify.list_properties`

  * **Input**: `{ params?: Record<string, any> }`
  * **Output**: Lodgify list payload (array/paged) → pass‑through JSON.
* `lodgify.get_quote`

  * **Input**: `{ propertyId: string, params: Record<string, any> }` where params may include `roomTypes[0].Id`, `guest_breakdown`, `addOns[0].Id`, `from`, `to`, etc.
  * **Output**: Quote calculation JSON.
* `lodgify.update_key_codes`

  * **Input**: `{ id: string, payload: object }` (payload shape per Lodgify docs).
  * **Output**: Updated booking object or status JSON.

> All tools MUST validate inputs with zod and surface a helpful error when invalid.

### FR‑3: Error Handling

* Map non‑2xx to structured `Error` including status, path, and Lodgify error payload (if JSON).
* On 429: read `Retry-After` seconds if present; otherwise use exponential backoff (2^attempt seconds, capped at 30s); max 5 attempts.
* Return final error to MCP client if retries exhausted.

### FR‑4: Query Encoding

* Support bracket‑notation for nested objects/arrays in query params (e.g., `roomTypes[0].Id=…`).

### FR‑5: Health Resource

* `lodgify://health` returns `{ ok: true, baseUrl: "https://api.lodgify.com" }`.

---

## 10) Non‑Functional Requirements

* **Performance**: Add minimal overhead; per‑call latency dominated by Lodgify.
* **Security**: Do not log raw API keys or PII. Mask obvious sensitive fields in errors/logs.
* **Reliability**: Handle network errors with retry (except non‑retryable statuses 4xx other than 429).
* **Maintainability**: Clear separation of MCP server and HTTP client. Typed interfaces and zod validation.

---

## 11) External Interfaces (Tool Catalog)

```jsonc
[
  { "name": "lodgify.list_properties", "desc": "GET /v2/properties", "input": {"params?": "object"} },
  { "name": "lodgify.get_property", "desc": "GET /v2/properties/{id}", "input": {"id": "string"} },
  { "name": "lodgify.list_property_rooms", "desc": "GET /v2/properties/{id}/rooms", "input": {"propertyId": "string"} },
  { "name": "lodgify.list_deleted_properties", "desc": "GET /v2/deletedProperties", "input": {"params?": "object"} },

  { "name": "lodgify.daily_rates", "desc": "GET /v2/rates/calendar", "input": {"params": "object"} },
  { "name": "lodgify.rate_settings", "desc": "GET /v2/rates/settings", "input": {"params": "object"} },

  { "name": "lodgify.list_bookings", "desc": "GET /v2/reservations/bookings", "input": {"params?": "object"} },
  { "name": "lodgify.get_booking", "desc": "GET /v2/reservations/bookings/{id}", "input": {"id": "string"} },
  { "name": "lodgify.get_booking_payment_link", "desc": "GET /v2/reservations/bookings/{id}/quote/paymentLink", "input": {"id": "string"} },
  { "name": "lodgify.create_booking_payment_link", "desc": "POST /v2/reservations/bookings/{id}/quote/paymentLink", "input": {"id": "string", "payload": "object"} },
  { "name": "lodgify.update_key_codes", "desc": "PUT /v2/reservations/bookings/{id}/keyCodes", "input": {"id": "string", "payload": "object"} },

  { "name": "lodgify.availability_room", "desc": "GET /v2/availability/{propertyId}/{roomTypeId}", "input": {"propertyId": "string", "roomTypeId": "string", "params?": "object"} },
  { "name": "lodgify.availability_property", "desc": "GET /v2/availability/{propertyId}", "input": {"propertyId": "string", "params?": "object"} },

  { "name": "lodgify.get_quote", "desc": "GET /v2/quote/{propertyId}", "input": {"propertyId": "string", "params": "object"} },
  { "name": "lodgify.get_thread", "desc": "GET /v2/messaging/{threadGuid}", "input": {"threadGuid": "string"} }
]
```

---

## 12) Configuration

* `.env.example`

  ```bash
  LODGIFY_API_KEY=your_api_key_here
  LOG_LEVEL=info
  ```
* No base URL env var; always `https://api.lodgify.com`.

---

## 13) Error Model (examples)

```json
{
  "error": true,
  "message": "Lodgify GET /v2/properties -> 401 Unauthorized",
  "status": 401,
  "path": "/v2/properties",
  "detail": { /* pass-through Lodgify error JSON if available */ }
}
```

---

## 14) Observability

* Log each request: method, path, ms, status; redact secrets.
* On error: include attempt count and `Retry-After` when present.
* Optional `DEBUG_HTTP=1` to echo resolved URL & query map in development.

---

## 15) Security & Compliance

* API key stored via environment variable; never written to logs.
* Avoid logging PII; allow an allow‑list of safe fields when pretty‑printing objects in debug.
* Document rotation steps for keys (README).

---

## 16) Testing & QA

* **Unit**: `lodgify.ts` request layer (429 backoff, query flattening, error shape).
* **Integration (live or mocked)**: Hit each tool with a sample input and assert basic invariants (status OK, required fields).
* **Contract tests**: Golden files for tool outputs (sanitized) to catch regressions.
* **Smoke script**: Node script that sequentially calls all tools using a test key.

---

## 17) Release Plan

* v0.1: Core tools + docs + tests.
* v0.2: Add more v2 coverage (e.g., additional booking operations) and typed response narrowing.
* v0.3: Optional webhook relay (if we decide to support v1 webhooks).

**Compatibility**: Semantic versioning; breaking tool signature changes → major.

---

## 18) Milestones & Timeline

1. **Design sign‑off** (this PRD) — 0.5d
2. **Scaffold project** (`lodgify-mcp`) — 0.5d
3. **HTTP client** with retries & query flattener — 1d
4. **Tool registrations** + zod validation — 1.5d
5. **Tests (unit + smoke)** — 1d
6. **Docs/README** + examples — 0.5d
7. **Cut v0.1 release** — 0.5d

---

## 19) Risks & Mitigations

* **API surface drift**: Keep endpoints loosely typed (pass‑through JSON) initially; add types later.
* **Rate limit spikes (429)**: Backoff with `Retry-After` support; configurably cap concurrency in future.
* **Schema variability**: Avoid hard assumptions; let Task Master AI rely on docstrings and examples.

---

## 20) Open Questions

* Should we include typed models for common entities (Property, Booking) now or later?
* Do we want a simple in‑memory cache for GETs to reduce rate usage?
* Any immediate v2 endpoints missing from MVP for your workflow?

---

## 21) Acceptance Criteria (high‑level)

* Given a valid API key, when the server launches, **then** the `lodgify-health` resource returns `{ ok: true }`.
* Given the tools above, when invoked with valid inputs, **then** they complete with 2xx and return Lodgify JSON.
* Given a 429 response, **then** the client retries with backoff and respects `Retry-After` if present.
* Given malformed input, **then** zod returns descriptive validation errors.

---

## 22) Backlog for Task Master AI

**Epic A — Core Server**

* [ ] Create repo scaffold in `lodgify-mcp` with Node 18+, TypeScript, tsconfig, lint, jest/vitest.
* [ ] Add `@modelcontextprotocol/sdk`, `zod`, `dotenv`, `tsx` dev; wire `dev` and `build` scripts.
* [ ] Implement `src/lodgify.ts` with: base URL const, headers, JSON parsing, 429 backoff, query flattener, and typed request method.
* [ ] Implement `src/server.ts` and register all tools + health resource.
* [ ] Add input validation (zod) for every tool.

**Epic B — Quality & Tooling**

* [ ] Unit tests for retry/backoff, error shapes, and query flattening.
* [ ] Integration smoke tests (can run against live or mocked).
* [ ] Example scripts for each tool (CLI calls with sample params).
* [ ] README with quickstart, MCP client config (Claude Desktop), and tool catalog.

**Epic C — Observability & Security**

* [ ] Structured logging with `LOG_LEVEL`.
* [ ] Redaction utilities for sensitive fields.
* [ ] Error formatting util and standardized failure payloads.

**Epic D — Stretch (post‑v0.1)**

* [ ] Add more v2 endpoints (as demanded by usage).
* [ ] Optional webhook relay (if v1 webhooks are required by workflows).
* [ ] Optional in‑memory cache for GETs.

---

## 23) Example Calls (for docs/tests)

```
# List properties
{"tool": "lodgify.list_properties", "arguments": {"params": {"perPage": 50}}}

# Get quote (illustrative; params depend on account setup)
{"tool": "lodgify.get_quote", "arguments": {
  "propertyId": "12345",
  "params": {
    "from": "2025-11-20",
    "to": "2025-11-25",
    "roomTypes[0].Id": 999,
    "guest_breakdown[adults]": 2,
    "addOns[0].Id": 77
  }
}}

# Create booking payment link
{"tool": "lodgify.create_booking_payment_link", "arguments": {
  "id": "abc-123",
  "payload": {"amount": 50000, "currency": "USD"}
}}
```

---

## 24) Appendix: README Snippets

**Install & Run**

```bash
npm i
npm run build
cp .env.example .env  # set LODGIFY_API_KEY
npm start
```

**Claude Desktop config**

```jsonc
{
  "mcpServers": {
    "lodgify": {
      "command": "node",
      "args": ["dist/server.js"],
      "env": { "LODGIFY_API_KEY": "•••" }
    }
  }
}
```
