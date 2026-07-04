import type { Rule } from "@prisma/client";
import type { RuleCondition, EventContext } from "@/types/webhook";

// =============================================================================
// Rule Engine Service
// =============================================================================
//
// RESPONSIBILITY: Evaluate which rules apply to an incoming event.
//
// This is a PURE service — it has:
//   - No database calls
//   - No side effects
//   - No network I/O
//
// WHY PURE? The rule engine is the most critical business logic in the system.
// Pure functions are deterministic and trivially unit-testable without mocks,
// database seeds, or environment setup. Given the same rules and payload,
// it will always return the same matching rules.
//
// The route handler and Event Service handle all I/O. This service only
// receives already-fetched data and performs in-memory computation.
// =============================================================================

/**
 * Resolves a dot-notation field path from a nested object.
 *
 * Examples:
 *   getFieldValue({ action: "opened" }, "action")              → "opened"
 *   getFieldValue({ pull_request: { title: "WIP: fix" } },
 *                 "pull_request.title")                        → "WIP: fix"
 *   getFieldValue({ a: { b: { c: 42 } } }, "a.b.c")           → 42
 *   getFieldValue({}, "missing.field")                         → undefined
 */
function getFieldValue(payload: Record<string, any>, field: string): any {
  return field.split(".").reduce((obj, key) => {
    return obj != null ? obj[key] : undefined;
  }, payload);
}

/**
 * Evaluates a single condition against the event payload.
 *
 * All comparisons are performed as strings (after coercion via String()).
 * This keeps the condition format simple and consistent, since all values
 * stored in the DB JSON column are strings.
 */
function evaluateCondition(
  payload: Record<string, any>,
  condition: RuleCondition
): boolean {
  const rawValue = getFieldValue(payload, condition.field);

  // Undefined fields never match any condition
  if (rawValue === undefined || rawValue === null) return false;

  const actual = String(rawValue).toLowerCase();
  const expected = condition.value.toLowerCase();

  switch (condition.operator) {
    case "equals":
      return actual === expected;
    case "notEquals":
      return actual !== expected;
    case "contains":
      return actual.includes(expected);
    case "startsWith":
      return actual.startsWith(expected);
    case "endsWith":
      return actual.endsWith(expected);
    default:
      // Unknown operator — fail safe, do not match
      console.warn(`[RuleEngine] Unknown operator: ${(condition as any).operator}`);
      return false;
  }
}

/**
 * Evaluates whether a single rule matches the current event.
 *
 * A rule matches when:
 *   1. Its `eventType` matches the incoming event type (e.g. "pull_request")
 *   2. ALL of its conditions pass (AND logic)
 *
 * The `conditions` column is stored as JSON in the DB and parsed by Prisma
 * as `any`. We cast it to `RuleCondition[]` and validate the shape at runtime.
 */
function doesRuleMatch(rule: Rule, context: EventContext): boolean {
  // Gate 1: Event type must match
  if (rule.eventType !== context.eventType) return false;

  // Gate 2: Rule must be active
  if (!rule.isActive) return false;

  // Gate 3: All conditions must pass
  const conditions = rule.conditions as unknown as RuleCondition[];

  if (!Array.isArray(conditions) || conditions.length === 0) {
    // An empty condition array means "match all events of this type"
    return true;
  }

  return conditions.every((condition) =>
    evaluateCondition(context.payload, condition)
  );
}

/**
 * Public API: Given a list of rules and an event context, returns only the
 * rules that match.
 *
 * Called by EventService with the pre-fetched rules for the repository.
 */
export function matchRules(rules: Rule[], context: EventContext): Rule[] {
  return rules.filter((rule) => doesRuleMatch(rule, context));
}
