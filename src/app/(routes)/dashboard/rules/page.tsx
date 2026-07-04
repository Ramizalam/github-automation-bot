import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { BookOpen } from "lucide-react";
import RuleToggle from "@/components/features/RuleToggle";

// =============================================================================
// Rules Page — Server Component
//
// WHY SERVER? Fetches all rules with relation data from Prisma.
// The RuleToggle (isActive switch) is a Client Component — it needs onClick.
// Everything else is pure data display.
// =============================================================================

export default async function RulesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const rules = await prisma.rule.findMany({
    where: { repository: { userId: session.user.id } },
    include: {
      repository: true,
      _count: { select: { actionLogs: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Rules</h1>
        <p className="text-zinc-500 mt-1 text-sm">
          {rules.length} rule{rules.length !== 1 ? "s" : ""} across all repositories
        </p>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/30 border border-zinc-800 border-dashed rounded-xl">
          <BookOpen className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-zinc-300 font-semibold text-lg">No rules configured</h3>
          <p className="text-zinc-500 mt-2 text-sm max-w-sm mx-auto">
            Rules define what actions the bot takes when a webhook event arrives.
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="text-left px-5 py-3.5 font-medium">Rule</th>
                <th className="text-left px-5 py-3.5 font-medium">Repository</th>
                <th className="text-left px-5 py-3.5 font-medium">Event</th>
                <th className="text-left px-5 py-3.5 font-medium">Action</th>
                <th className="text-left px-5 py-3.5 font-medium">Conditions</th>
                <th className="text-left px-5 py-3.5 font-medium">Logs</th>
                <th className="text-left px-5 py-3.5 font-medium">Active</th>
                <th className="text-left px-5 py-3.5 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {rules.map((rule) => {
                const conditions = rule.conditions as any[];
                return (
                  <tr key={rule.id} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-zinc-200 font-medium">{rule.name}</p>
                      {rule.description && (
                        <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-[180px]">
                          {rule.description}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-zinc-400 font-mono text-xs">
                      {rule.repository.name}
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px] font-mono">
                        {rule.eventType}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20 text-[11px] font-mono">
                        {rule.actionType}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-zinc-500 text-xs">
                      {Array.isArray(conditions) && conditions.length > 0 ? (
                        <span className="text-zinc-400">
                          {conditions.length} condition{conditions.length !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="italic text-zinc-600">All events</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-zinc-400 text-center">
                      {rule._count.actionLogs}
                    </td>
                    <td className="px-5 py-4">
                      {/* RuleToggle is a Client Component */}
                      <RuleToggle ruleId={rule.id} isActive={rule.isActive} />
                    </td>
                    <td className="px-5 py-4 text-zinc-500 text-xs">
                      {new Date(rule.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
