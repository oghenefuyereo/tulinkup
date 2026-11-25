import AdminOverviewRefresh from "@/components/AdminOverviewRefresh";
import Link from "next/link";
import { AdminDashboardShell } from "@/components/AdminDashboardShell";

// Import server-side authentication utilities.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Prevent caching of protected administrator information.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Administrator Dashboard | TuLinkUp",
  robots: {
    index: false,
    follow: false,
  },
};

// Configure the Express backend URL.
const API_URL = (
  process.env.API_URL || "http://localhost:5001"
).replace(/\/+$/, "");

// Verify protected requests through the Express backend.
async function getProtectedData(endpoint, token) {
  return fetch(API_URL + endpoint, {
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
    },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
}

// Display a safe error without exposing backend information.
function VerificationError() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <div className="panel p-8">
        <h1 className="text-2xl font-extrabold">
          Unable to verify administrator access
        </h1>
        <p className="mt-3 text-[#71809a]">
          Please try again later.
        </p>
      </div>
    </main>
  );
}

// Create the protected administrator dashboard.
export default async function AdminDashboard() {
  const cookieStore = await cookies();

  const token = cookieStore.get(
    "tulinkup_token"
  )?.value;

  // Require authentication before loading administrator content.
  if (!token) {
    redirect("/login");
  }

  let userResponse;
  let user;

  try {
    userResponse = await getProtectedData(
      "/api/auth/me",
      token
    );

    if (userResponse.ok) {
      const data = await userResponse.json();
      user = data.user;
    }
  } catch {
    return <VerificationError />;
  }

  // Reject invalid or expired authentication.
  if (userResponse.status === 401) {
    redirect("/login");
  }

  if (!userResponse.ok || !user) {
    return <VerificationError />;
  }

  // Redirect authenticated students to their own dashboard.
  if (user.role === "student") {
    redirect("/dashboard/student");
  }

  // Redirect authenticated tutors to their own dashboard.
  if (user.role === "tutor") {
    redirect("/dashboard/tutor");
  }

  // Reject unsupported roles.
  if (user.role !== "admin") {
    redirect("/login");
  }

  // Confirm authorization using the protected administrator API.
  let adminResponse;

  try {
    adminResponse = await getProtectedData(
      "/api/admin/dashboard",
      token
    );
  } catch {
    return <VerificationError />;
  }

  if (adminResponse.status === 401) {
    redirect("/login");
  }

  if (!adminResponse.ok) {
    return <VerificationError />;
  }


  // Read the statistics returned by the protected administrator API.
  let dashboard;

  try {
    dashboard = await adminResponse.json();
  } catch {
    return <VerificationError />;
  }

  const statistics = dashboard?.statistics;

  function validCount(value) {
    return Number.isSafeInteger(value) && value >= 0;
  }

  const statisticGroups = [
    {
      title: "Platform users",
      href: "/dashboard/admin/users",
      items: [
        ["Total users", statistics?.users?.total],
        ["Students", statistics?.users?.students],
        ["Tutors", statistics?.users?.tutors],
        ["Administrators", statistics?.users?.administrators],
      ],
    },
    {
      title: "Account status",
      href: "/dashboard/admin/users",
      items: [
        ["Active accounts", statistics?.users?.active],
        ["Suspended accounts", statistics?.users?.suspended],
        ["Removed accounts", statistics?.users?.removed],
      ],
    },
    {
      title: "Tutor approvals",
      href: "/dashboard/admin/tutor-approvals",
      items: [
        ["Pending", statistics?.tutorApprovals?.pending],
        ["Approved", statistics?.tutorApprovals?.approved],
        ["Rejected", statistics?.tutorApprovals?.rejected],
      ],
    },
    {
      title: "Learning activity",
      href: "/dashboard/admin/bookings",
      items: [
        ["Private bookings", statistics?.bookings?.total],
        ["Group classes", statistics?.groupClasses?.total],
        ["Group enrollments", statistics?.groupClasses?.enrollments],
        ["Classroom sessions", statistics?.liveSessions?.total],
      ],
    },
  ];

  // Reject missing or invalid statistics instead of displaying misleading totals.
  if (
    dashboard?.success !== true ||
    !statisticGroups.every(group =>
      group.items.every(([, value]) => validCount(value))
    ) ||
    typeof dashboard.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(dashboard.generatedAt))
  ) {
    return <VerificationError />;
  }

  const users = statistics.users;

  if (
    users.students + users.tutors + users.administrators !== users.total ||
    users.active + users.suspended + users.removed !== users.total
  ) {
    return <VerificationError />;
  }

  const fullName =
    user.full_name ||
    user.fullName ||
    "Administrator";

  const modules = [
    {
      title: "User management",
      description: "Manage student and tutor accounts.",
      href: "/dashboard/admin/users",
    },
    {
      title: "Student management",
      description: "Review student accounts and learning activity.",
      href: "/dashboard/admin/students",
    },
    {
      title: "Tutor management",
      description: "Review tutor profiles and teaching activity.",
      href: "/dashboard/admin/tutors",
    },
    {
      title: "Tutor approvals",
      description: "Review and manage tutor approval decisions.",
      href: "/dashboard/admin/tutor-approvals",
    },
    {
      title: "Booking monitoring",
      description: "Monitor private tutoring bookings.",
      href: "/dashboard/admin/bookings",
    },
    {
      title: "Group class monitoring",
      description: "Monitor classes, capacity and enrollments.",
      href: "/dashboard/admin/group-classes",
    },
    {
      title: "Message reports",
      description: "Review reported messages and manage moderation decisions.",
      href: "/dashboard/admin/message-reports",
    },
  ];

  const numberFormat = new Intl.NumberFormat("en-CA");

  const updatedAt = new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  }).format(new Date(dashboard.generatedAt));

  return (
    <AdminDashboardShell name={fullName} activePage="overview">
      <div className="min-w-0">
        <p className="eyebrow">TuLinkUp Administration</p>

        <h1 className="mt-2 text-3xl font-extrabold text-[#173472]">
          Administrator Dashboard
        </h1>

        <p className="mt-3 text-[#71809a]">
          Welcome, {fullName}. Monitor and manage your platform.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Last updated: {updatedAt} (Toronto time)
          </p>

          <AdminOverviewRefresh />
        </div>

        <section
          aria-labelledby="platform-statistics"
          className="mt-6"
        >
          <h2
            id="platform-statistics"
            className="text-xl font-extrabold text-[#173472]"
          >
            Platform statistics
          </h2>

          <div className="mt-4 grid gap-5 xl:grid-cols-2">
            {statisticGroups.map(group => (
              <article key={group.title} className="panel p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-extrabold text-[#173472]">
                    {group.title}
                  </h3>

                  <Link
                    href={group.href}
                    className="text-sm font-bold text-[#26469b]"
                  >
                    View records
                  </Link>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-3">
                  {group.items.map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl bg-slate-50 p-4"
                    >
                      <dt className="text-sm text-slate-600">
                        {label}
                      </dt>

                      <dd className="mt-2 text-2xl font-extrabold text-[#173472]">
                        {numberFormat.format(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Statistics include historical records and are updated when
            the overview is loaded.
          </p>
        </section>

        <section
          aria-labelledby="administration-modules"
          className="mt-8"
        >
          <h2
            id="administration-modules"
            className="text-xl font-extrabold text-[#173472]"
          >
            Administration modules
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map(module => (
              <Link
                key={module.href}
                href={module.href}
                className="panel block p-5 transition hover:border-[#173472]"
              >
                <h3 className="font-extrabold text-[#173472]">
                  {module.title}
                </h3>

                <p className="mt-2 text-sm text-slate-600">
                  {module.description}
                </p>

                <span className="mt-4 block text-sm font-bold text-[#26469b]">
                  Open module
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AdminDashboardShell>
  );
}
