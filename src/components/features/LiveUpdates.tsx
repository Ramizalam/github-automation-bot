"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// =============================================================================
// LiveUpdates — Client Component
// =============================================================================
//
// Establishes a Server Sent Events (SSE) connection to /api/sse.
// 
// When it receives a "refresh" signal from the server, it calls router.refresh().
// This instructs Next.js to re-fetch and re-render the Server Components for
// the current route (e.g. the Events table, the Action Logs table, or the
// Stat cards) WITHOUT performing a full page reload or losing client state.
//
// By doing this, we get real-time UI updates while keeping the complex data
// fetching logic entirely on the server.
//
// The browser's native EventSource API automatically handles reconnections
// if the connection drops.
// =============================================================================

export default function LiveUpdates() {
  const router = useRouter();

  useEffect(() => {
    // Open connection
    const eventSource = new EventSource("/api/sse");

    // Listen for messages
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "refresh") {
          console.log("[LiveUpdates] Refresh signal received — reloading server data");
          router.refresh();
        }
      } catch (err) {
        console.error("[LiveUpdates] Error parsing SSE message", err);
      }
    };

    eventSource.onerror = () => {
      // EventSource handles its own exponential backoff reconnection.
      // We just log that a disruption occurred.
      console.warn("[LiveUpdates] SSE connection lost. Reconnecting...");
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
    };
  }, [router]);

  return null; // This is a logic-only component, it renders nothing visible
}
