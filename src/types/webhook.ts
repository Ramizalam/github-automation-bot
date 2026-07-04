// =============================================================================
// Shared interfaces for the webhook event processing pipeline.
//
// These types are the contract between all pipeline layers:
//   - RuleCondition: how conditions are stored in the DB (JSON column)
//   - ActionResult:  what the Action Service reports back
//   - EventContext:  the immutable context passed through the full pipeline
// =============================================================================

/**
 * A single condition stored inside a Rule's `conditions` JSON column.
 *
 * `field` uses dot-notation to resolve a value from the GitHub event payload.
 *   Examples:
 *     "action"                   → payload.action
 *     "pull_request.title"       → payload.pull_request.title
 *     "pull_request.draft"       → payload.pull_request.draft
 *     "sender.login"             → payload.sender.login
 *
 * All conditions within a single Rule are evaluated with AND logic:
 *   a rule matches only when EVERY condition passes.
 */
export interface RuleCondition {
  field: string;
  operator: "equals" | "notEquals" | "contains" | "startsWith" | "endsWith";
  value: string;
}

/**
 * The result returned by ActionService after attempting to execute one action.
 */
export interface ActionResult {
  ruleId: string;
  actionType: string;
  status: "SUCCESS" | "FAILED";
  errorMessage?: string;
}

/**
 * Immutable context object assembled by EventService and passed to the
 * RuleEngine and ActionService. Avoids re-fetching the event from the DB
 * at each pipeline stage.
 */
export interface EventContext {
  eventId: string;
  repositoryId: string;
  eventType: string;            // e.g. "pull_request", "issues", "push"
  action: string | null;        // e.g. "opened", "closed", "labeled"
  payload: Record<string, any>; // raw GitHub webhook payload
}

/**
 * Supported action types. The actionPayload JSON shape varies by type.
 *
 * add_label         → { label: string }
 * send_slack_message → { message: string }  (supports {{payload.field}} templating)
 * close_issue       → {}
 */
export type SupportedActionType =
  | "add_label"
  | "send_slack_message"
  | "close_issue";
