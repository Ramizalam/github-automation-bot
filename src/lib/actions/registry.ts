import type { IActionStrategy } from "@/lib/actions/base.action";

// =============================================================================
// ActionRegistry
// =============================================================================
//
// A Map-backed singleton that maps `actionType` strings to their concrete
// strategy implementations.
//
// WHY A REGISTRY INSTEAD OF A SWITCH?
//
//   switch (actionType) {           ← CLOSED: must edit this file to add types
//     case "add_label": ...
//     case "send_slack": ...
//   }
//
//   registry.get("add_label")       ← OPEN: new types added without editing here
//
// The registry itself never changes. Only `index.ts` (the bootstrap file) adds
// new strategies to it. This is the Open/Closed Principle in practice.
//
// THREAD SAFETY: Node.js is single-threaded, so a shared Map is safe.
// The registry is populated once at module load time and never mutated again.
// =============================================================================

class ActionRegistry {
  private readonly strategies = new Map<string, IActionStrategy>();

  /**
   * Register a strategy. Called once per strategy at startup via index.ts.
   * Throws if a strategy with the same actionType is registered twice —
   * this catches accidental duplicate registrations early.
   */
  register(strategy: IActionStrategy): void {
    if (this.strategies.has(strategy.actionType)) {
      throw new Error(
        `[ActionRegistry] Duplicate strategy registration for actionType: "${strategy.actionType}"`
      );
    }
    this.strategies.set(strategy.actionType, strategy);
  }

  /**
   * Retrieve a strategy by actionType.
   * Returns undefined if no strategy is registered for the given type.
   * The caller (ActionService) is responsible for handling the undefined case.
   */
  get(actionType: string): IActionStrategy | undefined {
    return this.strategies.get(actionType);
  }

  /**
   * Returns all registered action type names.
   * Useful for validation when creating rules in the UI.
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.strategies.keys());
  }
}

// Export a singleton — the same registry instance is shared across the app
export const actionRegistry = new ActionRegistry();
