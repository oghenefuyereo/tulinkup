"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export default function AdminOverviewRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Request fresh dashboard statistics.
  function refreshOverview() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={refreshOverview}
      disabled={pending}
      aria-busy={pending}
      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"
    >
      {pending ? "Refreshing..." : "Reload overview"}
    </button>
  );
}
