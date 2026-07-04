import { auth, signOut } from "@/lib/auth"
import ConnectRepositoryModal from "@/components/features/ConnectRepositoryModal"
import RepositoryList from "@/components/features/RepositoryList"

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <header className="max-w-7xl mx-auto flex justify-between items-center py-6 border-b border-zinc-800 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-zinc-500 mt-1">Manage your GitHub automation rules.</p>
        </div>
        <div className="flex items-center gap-6">
          <ConnectRepositoryModal />
          
          <div className="w-px h-8 bg-zinc-800"></div>

          <div className="flex items-center gap-3">
            {session?.user?.image && (
              <img 
                src={session.user.image} 
                alt="Profile" 
                className="w-10 h-10 rounded-full border border-zinc-700" 
              />
            )}
            <form
              action={async () => {
                "use server"
                await signOut({ redirectTo: "/" })
              }}
            >
              <button 
                type="submit" 
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-medium rounded-md transition-colors border border-zinc-800 hover:border-zinc-700"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-8">
        <div>
          <h2 className="text-xl font-semibold mb-6 text-zinc-100">Connected Repositories</h2>
          <RepositoryList />
        </div>
      </main>
    </div>
  );
}
