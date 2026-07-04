"use client";

import { useState, useTransition } from "react";

// =============================================================================
// RuleToggle — Client Component
//
// WHY CLIENT? Needs onClick to toggle the rule's active state and useTransition
// for optimistic UI (the switch flips immediately, then syncs with the server).
// =============================================================================

export default function RuleToggle({
  ruleId,
  isActive,
}: {
  ruleId: string;
  isActive: boolean;
}) {
  const [active, setActive] = useState(isActive);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const next = !active;
    setActive(next); // optimistic update

    startTransition(async () => {
      try {
        const res = await fetch(`/api/rules/${ruleId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: next }),
        });
        if (!res.ok) {
          setActive(!next); // revert on failure
        }
      } catch {
        setActive(!next); // revert on network error
      }
    });
  };

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      aria-label={active ? "Deactivate rule" : "Activate rule"}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
        active ? "bg-indigo-600" : "bg-zinc-700"
      } ${isPending ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          active ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  );
}
