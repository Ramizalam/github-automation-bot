import { EventEmitter } from "events";

// =============================================================================
// Global Event Bus
// =============================================================================
//
// A singleton Node.js EventEmitter used to broadcast internal application
// state changes across the Next.js backend.
//
// WHY GLOBAL_THIS?
// In development, Next.js clears the module cache on every file change.
// If we just exported `new EventEmitter()`, a new bus would be created on
// hot reload, breaking connections between API routes and the SSE endpoint.
// Storing it on `globalThis` ensures the exact same instance survives reloads.
// =============================================================================

const globalForEventBus = globalThis as unknown as {
  eventBus: EventEmitter;
};

export const eventBus = globalForEventBus.eventBus || new EventEmitter();

// Increase max listeners since every active dashboard tab opens an SSE connection
// which registers a listener on this bus.
eventBus.setMaxListeners(100);

if (process.env.NODE_ENV !== "production") {
  globalForEventBus.eventBus = eventBus;
}
