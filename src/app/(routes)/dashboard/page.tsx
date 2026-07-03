import { auth, signOut } from "@/lib/auth"

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <header className="max-w-7xl mx-auto flex justify-between items-center py-6 border-b border-zinc-800">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {session?.user?.image && (
              <img 
                src={session.user.image} 
                alt="Profile" 
                className="w-10 h-10 rounded-full border border-zinc-700" 
              />
            )}
            <span className="text-zinc-300 font-medium">{session?.user?.name || "User"}</span>
          </div>
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/" })
            }}
          >
            <button 
              type="submit" 
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-medium rounded-md transition-colors border border-zinc-700"
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-12">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400">Welcome to your workspace!</h2>
          <p className="text-zinc-400 leading-relaxed">
            Your GitHub account is successfully connected. The authentication flow is completely secure and your session is managed via JWT cookies. 
            The repository connections and rules engine will be built in the next phase.
          </p>
          <div className="mt-8 p-4 bg-black/40 rounded-lg border border-zinc-800/50">
            <h3 className="text-sm font-medium text-zinc-500 mb-2">Session Data (Debug)</h3>
            <pre className="text-xs text-green-400 overflow-x-auto">
              {JSON.stringify(session, null, 2)}
            </pre>
          </div>
        </div>
      </main>
    </div>
  );
}
