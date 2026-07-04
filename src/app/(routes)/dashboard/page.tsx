import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { GitBranch, BookOpen, Zap, ScrollText, CheckCircle, XCircle, MinusCircle } from "lucide-react";

// =============================================================================
// Statistics Page — Server Component
//
// WHY SERVER? All data is fetched directly from the database via Prisma.
// No client-side data fetching, no useEffect, no loading spinners for initial
// render. The HTML arrives fully populated from the server.
// =============================================================================

export default async function StatisticsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const userId = session.user.id;

  // Single transaction — 6 queries in one round-trip
  const [
    repoCount,
    ruleCount,
    totalEvents,
    processedEvents,
    failedEvents,
    ignoredEvents,
    recentLogs,
  ] = await prisma.$transaction([
    prisma.repository.count({ where: { userId } }),
    prisma.rule.count({ where: { repository: { userId }, isActive: true } }),
    prisma.webhookEvent.count({ where: { repository: { userId } } }),
    prisma.webhookEvent.count({ where: { repository: { userId }, status: "PROCESSED" } }),
    prisma.webhookEvent.count({ where: { repository: { userId }, status: "FAILED" } }),
    prisma.webhookEvent.count({ where: { repository: { userId }, status: "IGNORED" } }),
    prisma.actionLog.findMany({
      where: { event: { repository: { userId } } },
      include: { event: { include: { repository: true } }, rule: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const stats = [
    { label: "Repositories", value: repoCount, icon: GitBranch, color: "indigo" },
    { label: "Active Rules", value: ruleCount, icon: BookOpen, color: "violet" },
    { label: "Total Events", value: totalEvents, icon: Zap, color: "amber" },
    { label: "Action Logs", value: recentLogs.length, icon: ScrollText, color: "emerald" },
  ];

  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-zinc-500 mt-1 text-sm">Your automation pipeline at a glance.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className={`inline-flex p-2 rounded-lg border ${colorMap[color]} mb-4`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-3xl font-bold text-white">{value}</p>
            <p className="text-zinc-500 text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Event Status Breakdown */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { label: "Processed", count: processedEvents, icon: CheckCircle, cls: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
          { label: "Failed", count: failedEvents, icon: XCircle, cls: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
          { label: "Ignored", count: ignoredEvents, icon: MinusCircle, cls: "text-zinc-400", bg: "bg-zinc-800/50 border-zinc-700/30" },
        ].map(({ label, count, icon: Icon, cls, bg }) => (
          <div key={label} className={`flex items-center gap-4 p-5 rounded-xl border ${bg}`}>
            <Icon className={`w-8 h-8 ${cls}`} />
            <div>
              <p className={`text-2xl font-bold ${cls}`}>{count}</p>
              <p className="text-zinc-500 text-sm">{label} Events</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Action Logs */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Recent Action Logs</h2>
        {recentLogs.length === 0 ? (
          <div className="text-center py-10 bg-zinc-900/30 border border-zinc-800 border-dashed rounded-xl text-zinc-500">
            No action logs yet. Connect a repository and configure rules to get started.
          </div>
        ) : (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="text-left px-5 py-3 font-medium">Action</th>
                  <th className="text-left px-5 py-3 font-medium">Repository</th>
                  <th className="text-left px-5 py-3 font-medium">Rule</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="px-5 py-3 text-zinc-300 font-mono text-xs">{log.actionType}</td>
                    <td className="px-5 py-3 text-zinc-400">{log.event.repository.name}</td>
                    <td className="px-5 py-3 text-zinc-400">{log.rule?.name ?? <span className="text-zinc-600 italic">deleted</span>}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-5 py-3 text-zinc-500 text-xs">{formatRelative(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    SUCCESS: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    FAILED: "bg-red-500/15 text-red-400 border-red-500/30",
    PENDING: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    PROCESSED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    IGNORED: "bg-zinc-700/40 text-zinc-500 border-zinc-600/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${map[status] ?? map.PENDING}`}>
      {status}
    </span>
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
