
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AvailabilityManager } from "@/components/AvailabilityManager";
import { DashboardShell } from "@/components/DashboardShell";

export const dynamic = "force-dynamic";

const API_URL = process.env.API_URL || "http://localhost:5001";

async function getProtectedData(path, token) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

export default async function AvailabilityPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tulinkup_token")?.value;

  if (!token) {
    redirect("/login");
  }

  let user;

  try {
    const data = await getProtectedData("/api/auth/me", token);
    user = data.user;
  } catch {
    redirect("/login");
  }

  if (!user || user.role !== "tutor") {
    redirect("/login");
  }

  let profile = null;
  let slots = [];
  let loadError = false;

  try {
    const profileData = await getProtectedData(
      "/api/tutors/me",
      token
    );

    profile = profileData.profile || null;

    if (profile) {
      const availabilityData = await getProtectedData(
        "/api/availability",
        token
      );

      slots = availabilityData.slots || [];
    }
  } catch {
    loadError = true;
  }

  return (
    <DashboardShell role="tutor" name={user.full_name}>
      <p className="eyebrow">Schedule settings</p>

      <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">
        Manage availability
      </h1>

      <p className="mt-2 text-[#71809a]">
        Keep your open times accurate so students only request
        sessions you can teach.
      </p>

      {loadError ? (
        <div className="panel mt-8 p-8 text-center">
          <h2 className="text-xl font-bold">
            Unable to load availability
          </h2>
          <p className="mt-2 text-[#71809a]">
            Please try again later.
          </p>
        </div>
      ) : profile ? (
        <div className="mt-8">
          <AvailabilityManager slots={slots} />
        </div>
      ) : (
        <div className="panel mt-8 p-8 text-center">
          <h2 className="text-xl font-bold">
            Complete your tutor profile first
          </h2>

          <p className="mt-2 text-[#71809a]">
            Your availability needs a professional profile
            to connect to.
          </p>

          <Link href="/profile" className="btn-primary mt-6">
            Create profile
          </Link>
        </div>
      )}
    </DashboardShell>
  );
}
