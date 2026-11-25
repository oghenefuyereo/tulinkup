import AdminMonitoring from "@/components/AdminMonitoring";
import { AdminDashboardShell } from "@/components/AdminDashboardShell";

// Import server-side authentication utilities.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Prevent caching of protected administrator information.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Booking Monitoring | TuLinkUp",
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
export default async function BookingMonitoringPage() {
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


  return (
    <AdminDashboardShell
      name={fullName}
      activePage="bookings"
    >
      <AdminMonitoring mode="bookings" />
    </AdminDashboardShell>
  );
}
