import prisma from "@/lib/prisma";
import { matchRules } from "@/services/rule-engine.service";
import { executeAction } from "@/services/action.service";
import type { ActionResult, EventContext } from "@/types/webhook";

// =============================================================================
// Event Service (Pipeline Orchestrator)
// =============================================================================
//
// RESPONSIBILITY: Coordinate the full processing lifecycle of a single
// WebhookEvent — from loading it out of the database to marking it PROCESSED.
//
// This service is the ONLY layer that knows the complete pipeline flow:
//   1. Load event + repository rules from DB
//   2. Build an immutable EventContext
//   3. Delegate condition evaluation to RuleEngine (pure, no I/O)
//   4. Delegate action execution to ActionService (side effects + logging)
//   5. Update WebhookEvent status based on results
//
// WHY AN ORCHESTRATOR? Separating orchestration from evaluation and execution
// means each service can evolve independently:
//   - Swap the rule engine for a more complex one without touching this file
//   - Add a new action type without touching this file
//   - Change the DB schema for events without touching the rule engine
//
// The route handler calls processEvent() as fire-and-forget. It never awaits
// the result — this ensures GitHub receives a 201 response within its 10-second
// timeout while processing continues in the background.
// =============================================================================

/**
 * Process a single WebhookEvent through the full pipeline.
 *
 * @param eventId - The internal DB id of the WebhookEvent to process.
 */
export async function processEvent(eventId: string): Promise<void> {
  // =========================================================================
  // STEP 1: Load the event and all active rules for its repository.
  //
  // We fetch rules in the same query to minimise round-trips.
  // We include only isActive rules — inactive rules are permanently skipped.
  // =========================================================================
  const event = await prisma.webhookEvent.findUnique({
    where: { id: eventId },
    include: {
      repository: {
        include: {
          rules: {
            where: { isActive: true },
          },
        },
      },
    },
  });

  if (!event) {
    console.error(`[EventService] Event not found: ${eventId}`);
    return;
  }

  // Guard: only process PENDING events (prevents double-processing if called twice)
  if (event.status !== "PENDING") {
    console.warn(
      `[EventService] Event ${eventId} is already in status "${event.status}" — skipping.`
    );
    return;
  }

  // =========================================================================
  // STEP 2: Build the immutable EventContext.
  //
  // This is a plain object containing everything the downstream services need.
  // It is assembled ONCE and passed through the pipeline — no service needs
  // to re-query the event from the database.
  // =========================================================================
  const context: EventContext = {
    eventId: event.id,
    repositoryId: event.repositoryId,
    eventType: event.event,
    action: event.action,
    payload: event.payload as Record<string, any>,
  };

  const rules = event.repository.rules;

  console.log(
    `[EventService] Processing event ${eventId} (${event.event}/${event.action ?? "*"}) ` +
    `— evaluating ${rules.length} rule(s).`
  );

  // =========================================================================
  // STEP 3: Delegate to the Rule Engine.
  //
  // matchRules() is a PURE function — no awaiting needed.
  // It returns only the rules whose conditions all pass.
  // =========================================================================
  const matchedRules = matchRules(rules, context);

  console.log(
    `[EventService] ${matchedRules.length}/${rules.length} rule(s) matched for event ${eventId}.`
  );

  // =========================================================================
  // STEP 4: Execute actions for each matched rule.
  //
  // We run actions sequentially (not Promise.all) so that:
  //   a) If one action fails, others still run
  //   b) ActionLog entries are written in a predictable order
  //   c) We avoid rate-limiting GitHub/Slack APIs in parallel bursts
  //
  // executeAction() never throws — it catches errors internally and
  // logs them as FAILED in the ActionLog table.
  // =========================================================================
  const results: ActionResult[] = [];

  for (const rule of matchedRules) {
    const result = await executeAction(rule, context);
    results.push(result);
  }

  // =========================================================================
  // STEP 5: Update the WebhookEvent status.
  //
  // PROCESSED: at least one rule matched and all actions completed (even if
  //            some individual actions FAILED — they are logged per action)
  // IGNORED:   no rules matched for this event type/conditions
  // FAILED:    an unexpected error occurred during the pipeline itself
  //            (not an action failure — those are caught in executeAction)
  // =========================================================================
  const hasFatalFailure = results.some(
    (r) => r.status === "FAILED" && matchedRules.length > 0
  );

  const finalStatus =
    matchedRules.length === 0
      ? "IGNORED"
      : hasFatalFailure
      ? "FAILED"
      : "PROCESSED";

  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: { status: finalStatus },
  });

  console.log(`[EventService] Event ${eventId} marked as ${finalStatus}.`);
}
