
import { cookies } from "next/headers";
import { DashboardShell } from "@/components/DashboardShell";
import { SignedOutState } from "@/components/SignedOutState";

export const dynamic = "force-dynamic";

const API_URL =
  process.env.API_URL || "http://localhost:5001";

// Verify the authenticated tutor account.
async function getAuthenticatedTutor(token) {
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

// Protect all tutor group class pages.
export default async function GroupClassesLayout({
  children,
}) {
  const cookieStore = await cookies();

  const token = cookieStore.get(
    "tulinkup_token"
  )?.value;

  if (!token) {
    return (
      <SignedOutState title="Log in with a tutor account" />
    );
  }

  let user;

  try {
    user = await getAuthenticatedTutor(token);
  } catch (error) {
    console.error(
      "Group classes authentication error:",
      error
    );

    return (
      <SignedOutState title="Unable to verify your tutor account" />
    );
  }

  if (!user || user.role !== "tutor") {
    return (
      <SignedOutState title="Log in with a tutor account" />
    );
  }

  const fullName =
    user.fullName || user.full_name || "Tutor";

  return (
    <DashboardShell role="tutor" name={fullName}>
      {children}
    </DashboardShell>
  );
}
