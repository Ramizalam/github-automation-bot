import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Zap } from "lucide-react";

// =============================================================================
// Events Page — Server Component
//
// WHY SERVER? Reads the 50 most recent webhook events with their repository
// name and action log count — all from the database, zero client JS.
// Status badges are rendered as static HTML on the server.
// =============================================================================

const STATUS_STYLES: Record<string, string> = {
  PENDING:   "bg-amber-500/15 text-amber-400 border-amber-500/30",
  PROCESSED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  FAILED:    "bg-red-500/15 text-red-400 border-red-500/30",
  IGNORED:   "bg-zinc-700/40 text-zinc-500 border-zinc-600/30",
};

const EVENT_STYLES: Record<string, string> = {
  pull_request: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  issues:       "bg-violet-500/10 text-violet-400 border-violet-500/20",
  push:         "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

export default async function EventsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const events = await prisma.webhookEvent.findMany({
    where: { repository: { userId: session.user.id } },
    include: {
      repository: true,
      _count: { select: { actionLogs: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Events</h1>
        <p className="text-zinc-500 mt-1 text-sm">
          Last {events.length} webhook events received
        </p>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/30 border border-zinc-800 border-dashed rounded-xl">
          <Zap className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-zinc-300 font-semibold text-lg">No events yet</h3>
          <p className="text-zinc-500 mt-2 text-sm max-w-sm mx-auto">
            Events appear here when GitHub sends webhook payloads to your connected repositories.
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="text-left px-5 py-3.5 font-medium">Delivery ID</th>
                <th className="text-left px-5 py-3.5 font-medium">Event</th>
                <th className="text-left px-5 py-3.5 font-medium">Action</th>
                <th className="text-left px-5 py-3.5 font-medium">Repository</th>
                <th className="text-left px-5 py-3.5 font-medium">Status</th>
                <th className="text-left px-5 py-3.5 font-medium">Logs</th>
                <th className="text-left px-5 py-3.5 font-medium">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-zinc-800/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-[11px] text-zinc-500 bg-zinc-800/60 px-2 py-0.5 rounded">
                      {event.githubDeliveryId.slice(0, 8)}…
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono border ${EVENT_STYLES[event.event] ?? "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
                      {event.event}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-400 text-xs">
                    {event.action ?? <span className="italic text-zinc-600">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-400 text-xs font-mono">
                    {event.repository.name}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${STATUS_STYLES[event.status] ?? STATUS_STYLES.PENDING}`}>
                      {event.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-zinc-400 text-center text-xs">
                    {event._count.actionLogs}
                  </td>
                  <td className="px-5 py-3.5 text-zinc-500 text-xs">
                    {formatRelative(event.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
