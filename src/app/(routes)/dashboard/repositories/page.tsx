import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { GitBranch, ExternalLink, Webhook, BookOpen, Zap } from "lucide-react";
import ConnectRepositoryModal from "@/components/features/ConnectRepositoryModal";

// =============================================================================
// Repositories Page — Server Component
//
// WHY SERVER? Fetches repositories with counts directly from Prisma.
// The ConnectRepositoryModal is a Client Component (it has onClick + fetch).
// =============================================================================

export default async function RepositoriesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const repositories = await prisma.repository.findMany({
    where: { userId: session.user.id },
    include: {
      _count: { select: { rules: true, webhookEvents: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Repositories</h1>
          <p className="text-zinc-500 mt-1 text-sm">
            {repositories.length} repository{repositories.length !== 1 ? "s" : ""} connected
          </p>
        </div>
        <ConnectRepositoryModal />
      </div>

      {repositories.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/30 border border-zinc-800 border-dashed rounded-xl">
          <GitBranch className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-zinc-300 font-semibold text-lg">No repositories connected</h3>
          <p className="text-zinc-500 mt-2 text-sm max-w-sm mx-auto">
            Connect a GitHub repository to start receiving webhook events and running automation rules.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {repositories.map((repo) => (
            <div
              key={repo.id}
              className="group bg-zinc-900/50 border border-zinc-800 hover:border-indigo-500/40 rounded-xl p-6 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                      <GitBranch className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-zinc-100 truncate">{repo.name}</h3>
                      <p className="text-xs text-zinc-500 truncate">{repo.fullName}</p>
                    </div>
                  </div>
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-600 hover:text-indigo-400 transition-colors shrink-0"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-zinc-800/40 rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-violet-400 mb-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span className="text-lg font-bold">{repo._count.rules}</span>
                    </div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Rules</p>
                  </div>
                  <div className="bg-zinc-800/40 rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-amber-400 mb-1">
                      <Zap className="w-3.5 h-3.5" />
                      <span className="text-lg font-bold">{repo._count.webhookEvents}</span>
                    </div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Events</p>
                  </div>
                </div>

                {/* Webhook secret (masked) */}
                <div className="bg-zinc-800/30 rounded-lg px-3 py-2 border border-zinc-700/30">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Webhook Secret</p>
                  <p className="font-mono text-xs text-zinc-500 truncate">
                    {repo.webhookSecret.slice(0, 8)}••••••••••••••••••••••••
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-800/50 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Webhook className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] text-emerald-400 font-medium">Webhook Ready</span>
                </div>
                <p className="text-[10px] text-zinc-600">
                  Added {new Date(repo.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
