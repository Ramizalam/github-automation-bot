// Bootstrap the action registry — must be imported before any action is dispatched
import "@/lib/actions/index";

import type { Rule } from "@prisma/client";
import prisma from "@/lib/prisma";
import { actionRegistry } from "@/lib/actions/registry";
import type { ActionResult, EventContext } from "@/types/webhook";

// =============================================================================
// Action Service
// =============================================================================
//
// RESPONSIBILITY: Execute the side effect defined by a matched rule and record
// the result in the ActionLog table.
//
// WHAT CHANGED (Strategy Pattern refactor):
//   Before: a switch statement dispatching to private functions — adding a new
//           action type required editing this file.
//   After:  a registry lookup — adding a new action type requires ONLY creating
//           a new strategy file and registering it in index.ts.
//
// This service now has two clear responsibilities:
//   1. Dispatch to the correct IActionStrategy via ActionRegistry
//   2. Persist every execution result to ActionLog (success or failure)
//
// It never throws — errors are caught, logged, and returned as FAILED results
// so one broken rule never blocks other rules from executing.
// =============================================================================

/**
 * Execute the action defined by a matched rule.
 *
 * Looks up the strategy from the registry, delegates execution, and persists
 * the result to ActionLog regardless of success or failure.
 */
export async function executeAction(
  rule: Rule,
  context: EventContext
): Promise<ActionResult> {
  const actionPayload = rule.actionPayload as Record<string, any>;
  const actionType = rule.actionType;

  let status: "SUCCESS" | "FAILED" = "SUCCESS";
  let errorMessage: string | undefined;

  try {
    // Registry lookup — replaces the switch statement entirely
    const strategy = actionRegistry.get(actionType);

    if (!strategy) {
      throw new Error(
        `No strategy registered for actionType: "${actionType}". ` +
        `Registered types: [${actionRegistry.getRegisteredTypes().join(", ")}]`
      );
    }

    await strategy.execute(context, actionPayload);
  } catch (err: any) {
    status = "FAILED";
    errorMessage = err?.message ?? "Unknown error";
    console.error(
      `[ActionService] Action "${actionType}" failed for rule ${rule.id}:`,
      errorMessage
    );
  }

  // Persist the result to ActionLog regardless of success or failure
  await prisma.actionLog.create({
    data: {
      actionType,
      status,
      errorMessage: errorMessage ?? null,
      eventId: context.eventId,
      ruleId: rule.id,
    },
  });

  return { ruleId: rule.id, actionType, status, errorMessage };
}
