import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardNav from "@/components/layout/DashboardNav";
import LiveUpdates from "@/components/features/LiveUpdates";

// =============================================================================
// Dashboard Layout — Server Component
//
// WHY SERVER? Auth check via auth() is a server-only operation. Layout doesn't
// need any interactivity — it just provides the structural shell.
// The sidebar (DashboardNav) is the only Client Component here.
// =============================================================================

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <LiveUpdates />
      {/* Sidebar — Client Component for usePathname() */}
      <DashboardNav />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top header */}
        <header className="h-16 border-b border-zinc-800/60 flex items-center justify-end px-8 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {session.user.image && (
              <img
                src={session.user.image}
                alt={session.user.name ?? "User"}
                className="w-8 h-8 rounded-full border border-zinc-700"
              />
            )}
            <span className="text-sm text-zinc-400 font-medium hidden sm:block">
              {session.user.name}
            </span>
            <div className="w-px h-5 bg-zinc-800" />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="text-xs px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all"
              >
                Sign Out
              </button>
            </form>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
