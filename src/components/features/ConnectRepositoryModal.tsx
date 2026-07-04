"use client";

import { useState } from "react";
import { Plus, GitBranch as Github, Loader2, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ConnectRepositoryModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connectingId, setConnectingId] = useState<number | null>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const router = useRouter();

  const fetchRepos = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/repositories");
      const data = await res.json();
      if (res.ok) {
        setRepos(data.available || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    fetchRepos();
  };

  const handleConnect = async (repo: any) => {
    setConnectingId(repo.githubId);
    try {
      const res = await fetch("/api/repositories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(repo),
      });

      if (res.ok) {
        // Refresh the page to update the Server Component list
        setIsOpen(false);
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <>
      <button 
        onClick={handleOpen}
        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-lg shadow-indigo-500/20 transition-all"
      >
        <Plus className="w-5 h-5" />
        Connect Repository
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Github className="w-6 h-6" />
                Select a Repository
              </h2>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors p-2"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
                  <p>Fetching your repositories from GitHub API...</p>
                </div>
              ) : repos.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 bg-zinc-900/20 rounded-xl border border-zinc-800/50">
                  <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-zinc-300">You're all caught up!</h3>
                  <p className="mt-2">All your repositories are already connected to the bot.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {repos.map(repo => (
                    <div key={repo.githubId} className="flex items-center justify-between p-4 rounded-lg border border-zinc-800 hover:border-indigo-500/50 bg-zinc-900/30 transition-all">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-zinc-200">{repo.name}</h4>
                          {repo.private && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                              Private
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">{repo.fullName}</p>
                      </div>
                      <button 
                        onClick={() => handleConnect(repo)}
                        disabled={connectingId === repo.githubId}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-2"
                      >
                        {connectingId === repo.githubId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Connect
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
