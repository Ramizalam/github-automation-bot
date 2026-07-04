import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { GitBranch as Github, ExternalLink, Webhook } from "lucide-react";

export default async function RepositoryList() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const repositories = await prisma.repository.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  if (repositories.length === 0) {
    return (
      <div className="text-center p-12 bg-zinc-900/30 border border-zinc-800 rounded-xl border-dashed">
        <Github className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
        <h3 className="text-zinc-300 font-medium text-lg">No repositories connected</h3>
        <p className="text-zinc-500 mt-2">Click the button above to connect your first GitHub repository.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {repositories.map((repo) => (
        <div key={repo.id} className="p-6 bg-zinc-900/50 border border-zinc-800 hover:border-indigo-500/50 transition-all rounded-xl backdrop-blur-sm group flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors">
                  <Github className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-100 truncate w-40" title={repo.name}>{repo.name}</h3>
                  <p className="text-xs text-zinc-500 truncate w-40">{repo.fullName}</p>
                </div>
              </div>
              <a href={repo.url} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-indigo-400 transition-colors">
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-zinc-800/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Webhook className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">Ready for Webhooks</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
