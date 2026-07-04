# Architecture & Design

This document details the architecture of the GitHub Automation Bot, including component responsibilities, database design, and key execution flows.

## Core Layers

1. **Routing & I/O (`src/app/api/webhooks/github`)**
   - Handles HTTP requests from GitHub.
   - Reads raw byte streams for HMAC signature validation.
   - Saves payloads to the database idempotently (preventing duplicates).
   - Returns a `201 Created` immediately and fires the orchestrator asynchronously.

2. **Orchestration (`src/services/event.service.ts`)**
   - Drives the lifecycle of a `WebhookEvent`.
   - Queries the database for rules matching the event's repository.
   - Delegates condition evaluation to the Rule Engine.
   - Delegates side effects to the Action Registry.
   - Updates the final `WebhookEvent` status (`PROCESSED`, `IGNORED`, `FAILED`).

3. **Rule Engine (`src/services/rule-engine.service.ts`)**
   - A pure, stateless class.
   - Takes a `Rule[]` and a payload context, returning only the matched `Rule[]`.
   - Supports dot-notation path resolution (e.g., `pull_request.title`).
   - Supports operators: `equals`, `notEquals`, `contains`, `startsWith`, `endsWith`.

4. **Action Strategies (`src/lib/actions/`)**
   - Implements the Strategy Pattern (`IActionStrategy`).
   - Resolves the rule's side effect (e.g., calling GitHub API or Slack).
   - Wrapped by `action.service.ts` to ensure every execution logs a success/failure to the `ActionLog` table.

## Database Schema (Prisma)

- **`User` / `Account` / `Session`**: Managed by Auth.js for GitHub OAuth.
- **`Repository`**: A connected GitHub repo. Stores the `webhookSecret` generated during setup.
- **`Rule`**: A user-defined automation. Contains a JSON array of `conditions`, the target `eventType`, and an `actionType` + `actionPayload`.
- **`WebhookEvent`**: A log of every payload received from GitHub. Driven by the `githubDeliveryId` to prevent duplicate processing. Status tracks `PENDING`, `PROCESSED`, `IGNORED`, or `FAILED`.
- **`ActionLog`**: A historical record of every side effect attempted by the bot, tracking success or the exact error message.

## Sequence Diagrams

### Webhook Delivery & Processing Pipeline

```mermaid
sequenceDiagram
    participant GitHub
    participant WebhookRoute as API (/api/webhooks/github)
    participant Database as DB (Postgres)
    participant EventService
    participant RuleEngine
    participant ActionRegistry

    GitHub->>WebhookRoute: POST Payload (Event, Sig, ID)
    WebhookRoute->>WebhookRoute: Verify HMAC Signature
    WebhookRoute->>Database: Save Event (UNIQUE githubDeliveryId)
    
    alt is Duplicate
        Database-->>WebhookRoute: P2002 Conflict Error
        WebhookRoute-->>GitHub: 200 OK (Already Processed)
    else is New
        WebhookRoute-->>GitHub: 201 Created
        WebhookRoute->>EventService: processEvent() (Fire & Forget)
    end

    Note over EventService: Background Processing Begins
    EventService->>Database: Fetch Rules for Repo
    Database-->>EventService: Rule[]
    EventService->>RuleEngine: matchRules(rules, payload)
    RuleEngine-->>EventService: Matched Rule[]

    loop For each matched rule
        EventService->>ActionRegistry: execute(rule, payload)
        ActionRegistry->>ActionRegistry: Strategy execution (e.g. Slack API)
        ActionRegistry->>Database: Create ActionLog (Success/Fail)
    end

    EventService->>Database: Update Event Status (PROCESSED)
```

### Live Updates (SSE) Flow

```mermaid
sequenceDiagram
    participant Dashboard as Client UI
    participant SSE as API (/api/sse)
    participant EventBus as Node EventEmitter
    participant EventService

    Dashboard->>SSE: Connect EventSource
    SSE->>EventBus: Subscribe 'webhook-update'
    
    EventService->>EventBus: Emit 'webhook-update' (DB changed)
    EventBus->>SSE: Trigger Listener
    SSE->>Dashboard: Stream: data: {"type": "refresh"}
    
    Dashboard->>Dashboard: router.refresh()
    Dashboard->>Database: Server Component Refetch
```
