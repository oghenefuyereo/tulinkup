
import { cookies } from "next/headers";
import { DashboardShell } from "@/components/DashboardShell";
import { SignedOutState } from "@/components/SignedOutState";
import StudentGroupClasses from "@/components/StudentGroupClasses";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Group Classes",
};

const API_URL =
  process.env.API_URL || "http://localhost:5001";

// Verify the student's authentication token.
async function getAuthenticatedStudent(token) {
  const response = await fetch(
    `${API_URL}/api/auth/me`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  return data.user || null;
}

export default async function StudentGroupClassesPage() {
  const cookieStore = await cookies();

  const token = cookieStore.get(
    "tulinkup_token"
  )?.value;

  if (!token) {
    return (
      <SignedOutState title="Log in with a student account" />
    );
  }

  let user;

  try {
    user = await getAuthenticatedStudent(token);
  } catch (error) {
    console.error(
      "Student authentication error:",
      error
    );

    return (
      <SignedOutState title="Unable to verify your student account" />
    );
  }

  if (!user || user.role !== "student") {
    return (
      <SignedOutState title="Log in with a student account" />
    );
  }

  const fullName =
    user.fullName ||
    user.full_name ||
    "Student";

  return (
    <DashboardShell
      role="student"
      name={fullName}
    >
      <StudentGroupClasses />
    </DashboardShell>
  );
}
