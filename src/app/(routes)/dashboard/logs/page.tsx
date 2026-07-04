import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { ScrollText } from "lucide-react";

// =============================================================================
// Action Logs Page — Server Component
//
// WHY SERVER? Reads the 50 most recent action logs with nested relations:
// event → repository, and rule. All rendered as static HTML — no client JS.
// Error messages are displayed inline for failed actions.
// =============================================================================

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  FAILED:  "bg-red-500/15 text-red-400 border-red-500/30",
  PENDING: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

export default async function ActionLogsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const logs = await prisma.actionLog.findMany({
    where: { event: { repository: { userId: session.user.id } } },
    include: {
      event: { include: { repository: true } },
      rule: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Action Logs</h1>
        <p className="text-zinc-500 mt-1 text-sm">
          Last {logs.length} action executions
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/30 border border-zinc-800 border-dashed rounded-xl">
          <ScrollText className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-zinc-300 font-semibold text-lg">No action logs yet</h3>
          <p className="text-zinc-500 mt-2 text-sm max-w-sm mx-auto">
            Every time a rule matches a webhook event and executes an action, the result is logged here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className={`bg-zinc-900/50 border rounded-xl p-5 transition-all ${
                log.status === "FAILED"
                  ? "border-red-500/30 bg-red-950/10"
                  : "border-zinc-800"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${STATUS_STYLES[log.status] ?? STATUS_STYLES.PENDING}`}>
                    {log.status}
                  </span>
                  <span className="font-mono text-xs text-zinc-300 bg-zinc-800/60 px-2 py-0.5 rounded truncate">
                    {log.actionType}
                  </span>
                </div>
                <span className="text-xs text-zinc-500 shrink-0">
                  {formatRelative(log.createdAt)}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-zinc-600 uppercase tracking-wider text-[10px] mb-0.5">Repository</p>
                  <p className="text-zinc-400 font-mono">{log.event.repository.name}</p>
                </div>
                <div>
                  <p className="text-zinc-600 uppercase tracking-wider text-[10px] mb-0.5">Event</p>
                  <p className="text-zinc-400">
                    {log.event.event}
                    {log.event.action ? ` / ${log.event.action}` : ""}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-600 uppercase tracking-wider text-[10px] mb-0.5">Rule</p>
                  <p className="text-zinc-400">
                    {log.rule?.name ?? <span className="italic text-zinc-600">Rule deleted</span>}
                  </p>
                </div>
              </div>

              {/* Error message — only shown for FAILED logs */}
              {log.status === "FAILED" && log.errorMessage && (
                <div className="mt-3 bg-red-950/30 border border-red-500/20 rounded-lg px-4 py-2.5">
                  <p className="text-[10px] text-red-500 uppercase tracking-wider mb-1 font-semibold">Error</p>
                  <p className="text-xs text-red-400 font-mono leading-relaxed">{log.errorMessage}</p>
                </div>
              )}
            </div>
          ))}
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
