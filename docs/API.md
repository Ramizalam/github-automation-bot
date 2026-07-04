# API Documentation

This outlines the internal API routes used by the GitHub Automation Bot. 

> Note: Most data fetching in this application is performed server-side directly against Prisma (via Next.js Server Components). API routes are only used for external webhooks, streaming (SSE), and state mutations triggered by Client Components.

## `POST /api/webhooks/github`

The primary ingress point for GitHub payloads.

- **Headers Required:**
  - `X-Hub-Signature-256`: The HMAC hex digest.
  - `X-GitHub-Event`: The type of event (e.g., `pull_request`, `issues`).
  - `X-GitHub-Delivery`: A UUID to prevent duplicate processing.
- **Body:** Raw JSON payload from GitHub.
- **Response:**
  - `201 Created` - Payload received, signature verified, processing started.
  - `200 OK` - Duplicate delivery ID received; ignored.
  - `401 Unauthorized` - Signature mismatch.
  - `404 Not Found` - The repository ID in the payload does not match any connected repository.

## `PATCH /api/rules/[id]`

Toggles the active state of a specific rule.

- **Authentication:** Required (via Auth.js session cookie). User must own the repository the rule belongs to.
- **Body:**
  ```json
  {
    "isActive": true
  }
  ```
- **Response:**
  - `200 OK` - `{ success: true, isActive: true }`
  - `401 Unauthorized` - Not logged in.
  - `404 Not Found` - Rule does not exist or user does not own it.

## `GET /api/sse`

Establishes a persistent Server Sent Events (SSE) stream for live dashboard updates.

- **Authentication:** Required.
- **Headers Returned:** `Content-Type: text/event-stream`
- **Stream Format:**
  When a relevant webhook event is saved or finishes processing, the server pushes:
  ```text
  data: {"type": "refresh"}
  \n\n
  ```
  The connected client (`LiveUpdates.tsx`) receives this and triggers `router.refresh()` to update the UI.
