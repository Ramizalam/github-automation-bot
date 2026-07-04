# AI Agent Knowledge Transfer Notes

These notes document architectural decisions, patterns, and constraints established during the development of this project. If an AI agent resumes work on this codebase, these guidelines must be followed.

## Architectural Principles

1. **Clean Architecture Separation:**
   - **Route Handlers (`src/app/api/`)**: Pure I/O. Parse headers, validate signatures, return fast HTTP responses. No business logic.
   - **Orchestrators (`src/services/event.service.ts`)**: Load data, coordinate other services, update statuses.
   - **Rule Engine (`src/services/rule-engine.service.ts`)**: Pure class. Zero network, zero database, zero side effects. Deterministic condition evaluation.
   - **Action Strategies (`src/lib/actions/`)**: Extensible layer for side effects (GitHub API calls, Slack).

2. **Webhooks and Concurrency:**
   - **Fire-and-Forget**: GitHub webhook routes must respond `201 Created` instantly after saving the payload to the DB, *before* running the rule engine. GitHub times out after 10 seconds.
   - **Deduplication**: GitHub webhooks use `X-GitHub-Delivery` UUIDs. The `WebhookEvent.githubDeliveryId` has a `UNIQUE` constraint in Postgres. If an insert fails with Prisma's `P2002` error, acknowledge the duplicate with a `200 OK` (so GitHub stops retrying).
   - **HMAC Signatures**: Always read `req.text()` *before* any JSON parsing for the `crypto.timingSafeEqual` signature check. Next.js JSON parsing alters whitespace, breaking the SHA256 digest.

3. **Strategy Pattern for Actions:**
   - Do not use `switch` statements for executing actions.
   - New actions must implement `IActionStrategy` in `src/lib/actions/base.action.ts` and be registered in `src/lib/actions/registry.ts`.
   - The registry throws on duplicate action types on load to fail fast.

4. **Live Updates (SSE over WebSockets):**
   - The dashboard updates via Server Sent Events (`/api/sse`).
   - The backend uses a global Node `EventEmitter` (`src/lib/event-bus.ts`) to broadcast `webhook-update` signals. 
   - `globalThis` is used to cache the event bus to survive Next.js dev server hot reloads.
   - The client receives a lightweight `{"type": "refresh"}` ping and calls Next.js's `router.refresh()`. Do not send heavy JSON payloads over SSE to manage in client state. Let Server Components do the heavy lifting.

5. **Prisma 7 & Next.js 16 Edge:**
   - Prisma requires the `PrismaPg` adapter (`@prisma/adapter-pg`) with a Node `Pool` connection to function correctly in this setup. See `src/lib/prisma.ts`.
   - Complex JSON properties (like `Rule.conditions`) are typed as `JsonValue` by Prisma. When validating shapes at runtime, cast via `unknown` (`rule.conditions as unknown as RuleCondition[]`).

6. **Slack Notifications:**
   - Uses Incoming Webhook URLs (no `Authorization` header needed).
   - Treat `SLACK_WEBHOOK_URL` as a sensitive secret.
   - Rejects `4xx` errors (bad payload) immediately. Only retries `5xx` and network errors via exponential backoff (`src/lib/slack/slack.service.ts`).
