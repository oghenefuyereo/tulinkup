import Link from "next/link";

// Keep administrator navigation separate from student and tutor dashboards.
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

              <Link
                href="/dashboard/admin/users"
                aria-current={activePage === "users" ? "page" : undefined}
                className={
                  "block rounded-xl px-4 py-3 font-bold text-white " +
                  (activePage === "users" ? "bg-[#26469b]" : "")
                }
              >
                All users
              </Link>


              <Link
                href="/dashboard/admin/students"
                aria-current={activePage === "students" ? "page" : undefined}
                className={
                  "block rounded-xl px-4 py-3 font-bold text-white " +
                  (activePage === "students" ? "bg-[#26469b]" : "")
                }
              >
                Students
              </Link>

              <Link
                href="/dashboard/admin/tutors"
                aria-current={activePage === "tutors" ? "page" : undefined}
                className={
                  "block rounded-xl px-4 py-3 font-bold text-white " +
                  (activePage === "tutors" ? "bg-[#26469b]" : "")
                }
              >
                Tutors
              </Link>


              <Link
                href="/dashboard/admin/bookings"
                aria-current={activePage === "bookings" ? "page" : undefined}
                className={
                  "block rounded-xl px-4 py-3 font-bold text-white " +
                  (activePage === "bookings" ? "bg-[#26469b]" : "")
                }
              >
                Bookings
              </Link>

              <Link
                href="/dashboard/admin/group-classes"
                aria-current={activePage === "group-classes" ? "page" : undefined}
                className={
                  "block rounded-xl px-4 py-3 font-bold text-white " +
                  (activePage === "group-classes" ? "bg-[#26469b]" : "")
                }
              >
                Group classes
              </Link>

              <Link
                href="/dashboard/admin/audit-logs"
                aria-current={
                  activePage === "audit-logs" ? "page" : undefined
                }
                className={
                  "block rounded-xl px-4 py-3 font-bold text-white " +
                  (activePage === "audit-logs" ? "bg-[#26469b]" : "")
                }
              >
                Audit logs
              </Link>

              <Link
                href="/dashboard/admin/settings"
                aria-current={
                  activePage === "settings" ? "page" : undefined
                }
                className={
                  "block rounded-xl px-4 py-3 font-bold text-white " +
                  (activePage === "settings" ? "bg-[#26469b]" : "")
                }
              >
                Settings
              </Link>
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
