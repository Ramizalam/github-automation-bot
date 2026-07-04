import type { EventContext } from "@/types/webhook";

// =============================================================================
// IActionStrategy — The Strategy Interface
// =============================================================================
//
// This is the contract that every action handler must satisfy.
//
// WHY AN INTERFACE? TypeScript interfaces define a structural contract without
// imposing any class hierarchy. Any object with an `actionType` string and an
// `execute` method is a valid strategy — this keeps strategies lightweight and
// easy to test.
//
// HOW IT ENABLES OPEN/CLOSED PRINCIPLE:
//   - The ActionRegistry is CLOSED for modification (never changes).
//   - The system is OPEN for extension: create a new file, implement this
//     interface, register it. Zero changes to existing code.
//
// ADDING A NEW ACTION TYPE (checklist):
//   1. Create `src/lib/actions/my-action.action.ts`
//   2. Implement IActionStrategy (add `actionType` + `execute`)
//   3. Import and register in `src/lib/actions/index.ts`
//   ✅ Done — no other files need to change.
// =============================================================================

export interface IActionStrategy {
  /**
   * The unique identifier for this action type.
   * MUST exactly match the value stored in the Rule.actionType DB column.
   *
   * Examples: "add_label", "send_slack_message", "close_issue"
   */
  readonly actionType: string;

  /**
   * Execute the action against the current event.
   *
   * @param context      - Immutable event context (eventId, repositoryId, payload, etc.)
   * @param actionPayload - The rule's `actionPayload` JSON (shape varies per strategy)
   *
   * Should throw an Error if the action cannot be completed.
   * Errors are caught by ActionService and logged as FAILED in the ActionLog.
   */
  execute(
    context: EventContext,
    actionPayload: Record<string, any>
  ): Promise<void>;
}
