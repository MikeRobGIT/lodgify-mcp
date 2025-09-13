# Product Requirements Document (PRD)

**Product**: Lodgify MCP Server
**Working Directory**: `lodgify-mcp`
**Owner**: Mike (SE)
**Version**: v0.2 (Refactor & Expanded Toolset)
**Last Updated**: 2025-09-02

---

## 1) Summary

Build a Model Context Protocol (MCP) server that exposes Lodgify Public API v2 (and selected v1) endpoints as MCP tools. This enables AI assistants and MCP‑aware IDEs to discover inventory, manage bookings, generate quotes, retrieve availability/rates, and receive messaging/webhook functionality via standardized tool interfaces.

**One‑liner**: “Operate Lodgify (v1+v2) via modular MCP tools.”

---

## 2) Goals & Non‑Goals

### Goals

* Provide a production‑ready MCP server implementing a curated set of Lodgify v2 endpoints.
* Make common tasks—listing properties, fetching availability, generating quotes, reading/updating bookings—trivial to orchestrate from AI agents.
* Offer strong error handling (429 backoff, structured errors), minimal configuration, and clean JSON outputs.
* Ship clear examples and a test harness so Task Master AI can generate sub‑tasks and validations.

### Non‑Goals (for now)

* Persistent DB/cache layer (beyond in‑memory rate/backoff state).
* GUI; consumers are MCP clients or programmatic runners.
* Build a persistent DB/cache layer (beyond in‑memory rate/backoff state).
* Provide a GUI. (Consumers are MCP clients or programmatic runners.)

---

## 3) Users & Use Cases

**Primary user**: Developers/agents integrating Lodgify data/actions into workflows (scheduling, quoting, ops dashboards, messaging triage).

**Representative use cases**

* AI agent composes an itinerary: checks property availability, retrieves daily rates, produces a quote, generates a payment link for a booking.
* Ops assistant lists bookings filtered by date range/status; pulls a single booking and updates key codes.
* Support agent inspects a messaging thread by GUID.

---

## 4) Assumptions & Constraints

* Access to a valid **Lodgify API key** with the necessary scopes.
* Default base URL is `https://api.lodgify.com`. The orchestrator supports an override (for testing), but no env var is exposed by default.
* Execution environment: Node.js ≥ 18, network egress to Lodgify.
* Rate limiting exists; we must gracefully handle HTTP 429 with `Retry-After`.

---

## 5) Scope (current)

### Endpoints wrapped as MCP tools

Current tool categories (representative list; see docs/API_REFERENCE.md for full details):

* **Property Management**
  * `lodgify_list_properties` → GET `/v2/properties`
  * `lodgify_get_property` → GET `/v2/properties/{id}`
  * `lodgify_list_property_rooms` → GET `/v2/properties/{propertyId}/rooms`
  * `lodgify_find_properties` → helper search across properties(+bookings)
  * `lodgify_list_deleted_properties` → GET `/v2/deletedProperties`

* **Booking & Reservation Management**
  * `lodgify_list_bookings` → GET `/v2/reservations/bookings`
  * `lodgify_get_booking` → GET `/v2/reservations/bookings/{id}`
  * `lodgify_get_booking_payment_link` → GET `{id}/quote/paymentLink`
  * `lodgify_create_booking_payment_link` → POST `{id}/quote/paymentLink` (WRITE; read‑only enforced)
  * `lodgify_update_key_codes` → PUT `{id}/keyCodes` (WRITE; read‑only enforced)
  * `lodgify_checkin_booking` → PUT `{id}/checkin` (WRITE; read‑only enforced)
  * `lodgify_checkout_booking` → PUT `{id}/checkout` (WRITE; read‑only enforced)
  * `lodgify_get_external_bookings` → GET `{id}/externalBookings`
  * v1 CRUD: `lodgify_create_booking`, `lodgify_update_booking`, `lodgify_delete_booking` (WRITE; read‑only enforced)

* **Availability & Calendar**
  * `lodgify_get_property_availability` → GET `/v2/availability/{propertyId}` (most accurate availability checker)

* **Rates & Pricing**
  * `lodgify_daily_rates` → GET `/v2/rates/calendar`
  * `lodgify_rate_settings` → GET `/v2/rates/settings`
  * `lodgify_get_quote` → GET `/v2/quote/{propertyId}` (bracket‑notation params)
  * v1 bulk: `lodgify_update_rates` (WRITE; read‑only enforced)
  * Booking quote: `lodgify_create_booking_quote` (WRITE; read‑only enforced)

* **Messaging & Communication**
  * `lodgify_get_thread` → GET `/v2/messaging/{threadGuid}`
  * `lodgify_list_threads` → GET `/v2/messaging`
  * `lodgify_send_message` → POST `/v2/messaging/{threadGuid}/messages` (WRITE; read‑only enforced)
  * `lodgify_mark_thread_read` → PUT `/v2/messaging/{threadGuid}/read` (WRITE; read‑only enforced)
  * `lodgify_archive_thread` → PUT `/v2/messaging/{threadGuid}/archive` (WRITE; read‑only enforced)

* **Webhooks & Notifications (v1)**
  * `lodgify_list_webhooks` → GET `/webhooks/v1/list`
  * `lodgify_subscribe_webhook` → POST `/webhooks/v1/subscribe` (WRITE; read‑only enforced)
  * `lodgify_unsubscribe_webhook` → DELETE `/webhooks/v1/unsubscribe` (WRITE; read‑only enforced)

**Resources**

* `lodgify://health` resource for connectivity/health.

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
* **HTTP Core**: Robust client with query flattener (bracket‑notation), JSON handling, and 429 retry with exponential backoff.
* **Orchestrator**: `src/lodgify-orchestrator.ts` unifies v1+v2 modules and enforces read‑only on writes.
* **Date Validation**: Feedback‑based validation for availability/rates/booking tools to help agents self‑correct dates.
* **Error Handling**: Centralized handler with sanitization, Lodgify error mapping, and safe logging.
* **Config**: `.env` with `LODGIFY_API_KEY` and optional `LOG_LEVEL`.
* **Logging**: Console (JSON lines), levels: error | warn | info | debug. (Env: `LOG_LEVEL`.)

---

## 8) Directory Structure

```
lodgify-mcp/
├─ src/
│  ├─ server.ts                # Minimal entrypoint (delegates to server-setup)
│  ├─ lodgify-orchestrator.ts  # Unified v1+v2 orchestrator
│  ├─ api/
│  │  ├─ v1/{bookings,rates,webhooks}
│  │  └─ v2/{properties,bookings,availability,rates,quotes,messaging}
│  ├─ core/{http,retry,errors}
│  ├─ mcp/
│  │  ├─ server-setup.ts
│  │  ├─ tools/{property,booking,availability,rate,webhook,messaging}-tools.ts
│  │  ├─ resources/{resources,health-check}.ts
│  │  ├─ errors/handler.ts
│  │  ├─ schemas/*
│  │  └─ utils/*
│  ├─ env.ts                   # Zod-validated env + read-only
│  └─ logger.ts                # Pino logger + debug hooks
├─ tests/                      # Bun tests (unit/integration)
├─ dist/                       # Build output
└─ docs/                       # API reference & guides
```

---

## 9) Functional Requirements

### FR‑1: Authentication

* All outbound Lodgify requests set `X-ApiKey: <LODGIFY_API_KEY>` header.
* Server fails fast at startup if `LODGIFY_API_KEY` missing.

### FR‑2: Tool Contracts (Inputs/Outputs)

Each tool exposes a **Zod input schema** and returns Lodgify JSON as a stringified payload via MCP `{ content: [{ type: "text", text }] }` (sanitized where appropriate).

**Examples (abridged)**

* `lodgify_list_properties`

  * **Input**: `{ params?: Record<string, any> }`
  * **Output**: Lodgify list payload (array/paged) → pass‑through JSON.
* `lodgify_get_quote`

  * **Input**: `{ propertyId: string, params: Record<string, any> }` where params may include `roomTypes[0].Id`, `guest_breakdown`, `addOns[0].Id`, `from`, `to`, etc.
  * **Output**: Quote calculation JSON.
* `lodgify_update_key_codes`

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

* `lodgify://health` returns connection metadata (status, timestamp, version, API connectivity).

---

## 10) Non‑Functional Requirements

* **Performance**: Add minimal overhead; per‑call latency dominated by Lodgify.
* **Security**: Do not log raw API keys or PII. Mask obvious sensitive fields in errors/logs. Read‑only mode blocks all writes.
* **Reliability**: Handle network errors with retry (except non‑retryable statuses 4xx other than 429).
* **Maintainability**: Clear separation of MCP server and HTTP client. Typed interfaces and zod validation.

---

## 11) External Interfaces (Tool Catalog)

```jsonc
[
  { "name": "lodgify_list_properties", "desc": "GET /v2/properties" },
  { "name": "lodgify_get_property", "desc": "GET /v2/properties/{id}" },
  { "name": "lodgify_list_property_rooms", "desc": "GET /v2/properties/{id}/rooms" },
  { "name": "lodgify_find_properties", "desc": "Helper: discover properties" },
  { "name": "lodgify_list_deleted_properties", "desc": "GET /v2/deletedProperties" },

  { "name": "lodgify_list_bookings", "desc": "GET /v2/reservations/bookings" },
  { "name": "lodgify_get_booking", "desc": "GET /v2/reservations/bookings/{id}" },
  { "name": "lodgify_get_booking_payment_link", "desc": "GET /v2/reservations/bookings/{id}/quote/paymentLink" },
  { "name": "lodgify_create_booking_payment_link", "desc": "POST /v2/reservations/bookings/{id}/quote/paymentLink" },
  { "name": "lodgify_update_key_codes", "desc": "PUT /v2/reservations/bookings/{id}/keyCodes" },
  { "name": "lodgify_checkin_booking", "desc": "PUT /v2/reservations/bookings/{id}/checkin" },
  { "name": "lodgify_checkout_booking", "desc": "PUT /v2/reservations/bookings/{id}/checkout" },
  { "name": "lodgify_get_external_bookings", "desc": "GET /v2/reservations/bookings/{id}/externalBookings" },
  { "name": "lodgify_create_booking", "desc": "POST /v1/reservation/booking" },
  { "name": "lodgify_update_booking", "desc": "PUT /v1/reservation/booking/{id}" },
  { "name": "lodgify_delete_booking", "desc": "DELETE /v1/reservation/booking/{id}" },

  { "name": "lodgify_get_property_availability", "desc": "GET /v2/availability/{propertyId}" },

  { "name": "lodgify_daily_rates", "desc": "GET /v2/rates/calendar" },
  { "name": "lodgify_rate_settings", "desc": "GET /v2/rates/settings" },
  { "name": "lodgify_get_quote", "desc": "GET /v2/quote/{propertyId}" },
  { "name": "lodgify_update_rates", "desc": "POST /v1/rates/savewithoutavailability" },
  { "name": "lodgify_create_booking_quote", "desc": "POST /v2/reservations/bookings/{id}/quote" },

  { "name": "lodgify_get_thread", "desc": "GET /v2/messaging/{threadGuid}" },
  { "name": "lodgify_list_threads", "desc": "GET /v2/messaging" },
  { "name": "lodgify_send_message", "desc": "POST /v2/messaging/{threadGuid}/messages" },
  { "name": "lodgify_mark_thread_read", "desc": "PUT /v2/messaging/{threadGuid}/read" },
  { "name": "lodgify_archive_thread", "desc": "PUT /v2/messaging/{threadGuid}/archive" },

  { "name": "lodgify_list_webhooks", "desc": "GET /webhooks/v1/list" },
  { "name": "lodgify_subscribe_webhook", "desc": "POST /webhooks/v1/subscribe" },
  { "name": "lodgify_unsubscribe_webhook", "desc": "DELETE /webhooks/v1/unsubscribe" }
]
```

---

## 12) Configuration

* `.env.example`

  ```bash
  LODGIFY_API_KEY=your_api_key_here
  LOG_LEVEL=info
  DEBUG_HTTP=0
  LODGIFY_READ_ONLY=1
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

* **Unit**: HTTP/core layers (429 backoff, query flattening, error shape), orchestrator read‑only, module clients.
* **Integration (live or mocked)**: Hit each tool with a sample input and assert basic invariants (status OK, required fields).
* **Contract tests**: Golden files for tool outputs (sanitized) to catch regressions.
* **Smoke script**: Node script that sequentially calls all tools using a test key.

---

## 17) Release Plan

* v0.1: Core tools + docs + tests.
* v0.2: Refactor to orchestrator + registries; add v1 CRUD, webhooks, messaging tools, availability helpers.
* v0.3+: Optional enhancements (webhook relay, cache, additional v2 writes).

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

* Given a valid API key, when the server launches, **then** the `lodgify://health` resource returns a healthy status and API connectivity.
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
{"tool": "lodgify_list_properties", "arguments": {"page": 1, "size": 50}}

# Get quote (illustrative; params depend on account setup)
{"tool": "lodgify_get_quote", "arguments": {
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
{"tool": "lodgify_create_booking_payment_link", "arguments": {
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
