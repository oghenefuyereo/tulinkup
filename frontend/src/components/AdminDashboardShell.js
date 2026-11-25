import Link from "next/link";

// Keep administrator navigation separate from student and tutor dashboards.
const modules = [
  "All users",
  "Students",
  "Tutors",
  "Bookings",
  "Group classes",
  "Audit logs",
  "Settings",
];

export function AdminDashboardShell({ name, children, activePage = "overview" }) {
  return (
    <div className="min-h-screen bg-[#f7f9fd]">
      <div className="page-wrap grid gap-6 py-8 lg:grid-cols-[240px_minmax(0,1fr)]">

        <aside>
          <div className="rounded-2xl bg-[#173472] p-5 text-white lg:sticky lg:top-24">

            <p className="text-xs font-bold uppercase tracking-wider text-white/60">
              Administration
            </p>

            <p className="mt-2 break-words font-extrabold">
              {name}
            </p>

            <nav
              aria-label="Administrator navigation"
              className="mt-6 space-y-2"
            >
              <Link
                href="/dashboard/admin"
                aria-current={activePage === "overview" ? "page" : undefined}
                className={
    "block rounded-xl px-4 py-3 font-bold text-white " +
    (activePage === "overview" ? "bg-[#26469b]" : "")
  }
              >
                Overview
              </Link>

              <Link
    href="/dashboard/admin/tutor-approvals"
    aria-current={
      activePage === "tutor-approvals" ? "page" : undefined
    }
    className={
      "block rounded-xl px-4 py-3 font-bold text-white " +
      (activePage === "tutor-approvals" ? "bg-[#26469b]" : "")
    }
  >
    Tutor approvals
  </Link>

  {/* Enable the remaining modules when their pages are ready. */}
              <div className="grid grid-cols-2 gap-1 lg:grid-cols-1">
                {modules.map((label) => (
                  <div
                    key={label}
                    aria-disabled="true"
                    className="rounded-xl px-4 py-3 text-sm text-white/70"
                  >
                    <span>{label}</span>
                    <span className="mt-1 block text-xs text-white/60">
                      Coming soon
                    </span>
                  </div>
                ))}
              </div>
            </nav>

          </div>
        </aside>

        <main className="min-w-0">
          {children}
        </main>

      </div>
    </div>
  );
}
