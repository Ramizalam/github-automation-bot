import type { Rule } from "@prisma/client";
import type { RuleCondition, EventContext } from "@/types/webhook";

// =============================================================================
// RuleEngine Class
// =============================================================================
//
// RESPONSIBILITY: Evaluate which rules apply to an incoming event.
//
// WHAT CHANGED (class refactor):
//   Before: a module of loose exported/private functions.
//   After:  a named class with a clear public API and private implementation.
//
// WHY A CLASS?
//   1. Explicit contract — the public API is `matchRules()`. Everything else
//      is private by design, not by convention.
//   2. Extensibility — future behaviour changes (e.g. OR-logic between
//      conditions, rule priority, weighted scoring) can be added as methods
//      without changing the public interface or any caller.
//   3. Testability — you can instantiate `new RuleEngine()` in a test with
//      zero mocks. No database, no network, no environment variables.
//
// STILL PURE: This class performs NO I/O. Given the same inputs, it always
// returns the same output. The Event Service handles all database access.
// =============================================================================

export class RuleEngine {
  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Filter a list of rules to those that match the current event.
   *
   * Called by EventService with the pre-fetched rules for the repository.
   * Rules that are inactive or target a different event type are excluded
   * before condition evaluation begins, keeping evaluation fast.
   *
   * @param rules   - All active rules for the repository (pre-fetched from DB)
   * @param context - Immutable event context built by EventService
   * @returns       - Subset of rules whose conditions all pass
   */
  matchRules(rules: Rule[], context: EventContext): Rule[] {
    return rules.filter((rule) => this.doesRuleMatch(rule, context));
  }

  // ---------------------------------------------------------------------------
  // Private Implementation
  // ---------------------------------------------------------------------------

  /**
   * Evaluate a single rule against the event context.
   *
   * Three sequential gates — any failure short-circuits evaluation:
   *   Gate 1: eventType must match (string equality)
   *   Gate 2: rule must be active
   *   Gate 3: ALL conditions must pass (AND logic)
   *
   * An empty conditions array means "match all events of this type".
   */
  private doesRuleMatch(rule: Rule, context: EventContext): boolean {
    // Gate 1: Event type
    if (rule.eventType !== context.eventType) return false;

    // Gate 2: Active flag
    if (!rule.isActive) return false;

    // Gate 3: Conditions (stored as JSON, cast through unknown)
    const conditions = rule.conditions as unknown as RuleCondition[];

    if (!Array.isArray(conditions) || conditions.length === 0) {
      return true; // empty conditions = wildcard match
    }

    return conditions.every((condition) =>
      this.evaluateCondition(context.payload, condition)
    );
  }

  /**
   * Evaluate a single condition against the event payload.
   *
   * Resolves the `field` using dot-notation, then applies the `operator`.
   * All comparisons are case-insensitive string comparisons — consistent
   * with the values stored as strings in the DB JSON column.
   *
   * Supported operators:
   *   equals      — exact match
   *   notEquals   — must not match
   *   contains    — substring match
   *   startsWith  — prefix match
   *   endsWith    — suffix match
   */
  private evaluateCondition(
    payload: Record<string, any>,
    condition: RuleCondition
  ): boolean {
    const rawValue = this.resolveField(payload, condition.field);

    // Undefined or null fields never satisfy any condition
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
        // Unknown operator — fail safe (do not match), warn to aid debugging
        console.warn(
          `[RuleEngine] Unknown operator: "${(condition as any).operator}" on field "${condition.field}"`
        );
        return false;
    }
  }

  /**
   * Resolve a dot-notation field path from a nested object.
   *
   * Examples:
   *   resolveField({ action: "opened" }, "action")
   *     → "opened"
   *   resolveField({ pull_request: { title: "WIP: fix" } }, "pull_request.title")
   *     → "WIP: fix"
   *   resolveField({}, "missing.field")
   *     → undefined
   */
  private resolveField(obj: Record<string, any>, field: string): any {
    return field.split(".").reduce((current, key) => {
      return current != null ? current[key] : undefined;
    }, obj as any);
  }
}

// Singleton — shared across the app, constructed once at module load
export const ruleEngine = new RuleEngine();
