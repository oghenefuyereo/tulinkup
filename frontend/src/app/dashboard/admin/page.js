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

  const fullName =
    user.full_name ||
    user.fullName ||
    "Administrator";

  // Render administrator content only after successful verification.
  return (
    <AdminDashboardShell name={fullName}>
      <div className="min-w-0">

        <p className="eyebrow">
          TuLinkUp Administration
        </p>

        <h1 className="mt-2 text-3xl font-extrabold text-[#173472]">
          Administrator Dashboard
        </h1>

        <p className="mt-3 text-[#71809a]">
          Welcome back, {fullName}.
        </p>

        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5">
          <p className="font-bold text-green-800">
            Administrator access verified
          </p>

          <p className="mt-1 text-sm text-green-700">
            Your account has been successfully authenticated
            and authorized.
          </p>
        </div>

        <section className="mt-8">
          <h2 className="text-xl font-extrabold">
            Administration Modules
          </h2>

          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["User Management", "Manage platform accounts."],
              ["Tutor Management", "Review and approve tutors."],
              ["Student Management", "Manage student accounts."],
              ["Booking Management", "Monitor tutoring bookings."],
              ["Group Classes", "Monitor group learning activity."],
              ["Platform Analytics", "Review platform performance."],
            ].map(([title, description]) => (
              <div key={title} className="panel p-6">
                <h3 className="font-extrabold text-[#173472]">
                  {title}
                </h3>

                <p className="mt-2 text-sm text-[#71809a]">
                  {description}
                </p>

                <span className="mt-4 inline-block rounded-full bg-[#edf1fa] px-3 py-1 text-xs font-semibold text-[#26469b]">
                  Coming soon
                </span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </AdminDashboardShell>
  );
}
