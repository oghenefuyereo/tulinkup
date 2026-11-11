
import Link from "next/link";
import { Icon } from "./Icons";
import { MobileNav } from "./MobileNav";

export function DashboardShell({
  role,
  name,
  children,
}) {
  const items =
    role === "student"
      ? [
          ["dashboard", "Overview", "/dashboard/student"],
          ["search", "Browse tutors", "/tutors"],
          ["user", "My profile", "/profile"],
        ]
      : [
          ["dashboard", "Overview", "/dashboard/tutor"],
          ["user", "Manage profile", "/profile"],
          ["calendar", "Availability", "/availability"],
        ];

  return (
    <>
      <div className="min-h-screen bg-[#f7f9fd]">
        <div className="page-wrap grid gap-8 py-8 lg:grid-cols-[230px_1fr]">
          <aside className="hidden lg:block">
            <div className="panel sticky top-24 p-4">
              <div className="border-b border-[#edf0f5] px-3 pb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#8190a8]">
                  {role} account
                </p>

                <p className="mt-1 font-extrabold">
                  {name}
                </p>
              </div>

              <nav className="mt-4 space-y-1">
                {items.map(([icon, label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-[#5a6780] hover:bg-[#edf1fa] hover:text-[#173472]"
                  >
                    <Icon
                      name={icon}
                      className="h-5 w-5"
                    />
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          <div className="min-w-0">
            {children}
          </div>
        </div>
      </div>

      <MobileNav />
    </>
  );
}
