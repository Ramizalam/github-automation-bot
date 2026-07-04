"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GitBranch,
  Zap,
  ScrollText,
  BarChart3,
  BookOpen,
} from "lucide-react";

// =============================================================================
// DashboardNav — Client Component
//
// WHY CLIENT? Needs usePathname() to read the current URL and highlight the
// active nav link. This cannot be done in a Server Component.
//
// Everything else in the dashboard (data fetching, rendering tables) is
// Server Components — this is the only piece that requires client JS.
// =============================================================================

const navItems = [
  { href: "/dashboard", label: "Statistics", icon: BarChart3, exact: true },
  { href: "/dashboard/repositories", label: "Repositories", icon: GitBranch, exact: false },
  { href: "/dashboard/rules", label: "Rules", icon: BookOpen, exact: false },
  { href: "/dashboard/events", label: "Events", icon: Zap, exact: false },
  { href: "/dashboard/logs", label: "Action Logs", icon: ScrollText, exact: false },
];

export default function DashboardNav() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-zinc-950 border-r border-zinc-800/60 flex flex-col min-h-screen">
      {/* Logo / Brand */}
      <div className="px-6 py-6 border-b border-zinc-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">AutoBot</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">GitHub Automation</p>
          </div>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                isActive
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
              }`}
            >
              <Icon
                className={`w-4 h-4 transition-colors ${
                  isActive ? "text-indigo-400" : "text-zinc-500 group-hover:text-zinc-300"
                }`}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer label */}
      <div className="px-6 py-4 border-t border-zinc-800/60">
        <p className="text-[10px] text-zinc-600 uppercase tracking-widest">v1.0.0</p>
      </div>
    </aside>
  );
}
