import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { eventBus } from "@/lib/event-bus";

// =============================================================================
// Server Sent Events (SSE) Endpoint
// =============================================================================
//
// Maintains a persistent, unidirectional HTTP connection with the client.
// 
// When the global `eventBus` emits a "webhook-update" for the connected
// user's repository, it pushes a simple "refresh" signal down the stream.
//
// The client (LiveUpdates component) receives this signal and triggers a
// Next.js `router.refresh()` to fetch the updated HTML for the dashboard.
// =============================================================================

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send an initial ping to establish connection
      controller.enqueue(`data: {"type": "connected"}\n\n`);

      // 2. Define the event listener
      const onUpdate = (payload: { userId: string }) => {
        // Only notify if the event belongs to this user
        if (payload.userId === userId) {
          controller.enqueue(`data: {"type": "refresh"}\n\n`);
        }
      };

      // 3. Subscribe to the global event bus
      eventBus.on("webhook-update", onUpdate);

      // 4. Handle client disconnect
      req.signal.addEventListener("abort", () => {
        eventBus.off("webhook-update", onUpdate);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
