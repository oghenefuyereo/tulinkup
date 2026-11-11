
import { cookies } from "next/headers";

import { DashboardShell } from "@/components/DashboardShell";
import { ProfileForm } from "@/components/ProfileForm";
import { SignedOutState } from "@/components/SignedOutState";

export const dynamic = "force-dynamic";

const API_URL = process.env.API_URL || "http://localhost:5001";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tulinkup_token")?.value;

  if (!token) {
    return (
      <SignedOutState title="Log in to manage your profile" />
    );
  }

  const userResponse = await fetch(`${API_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!userResponse.ok) {
    return (
      <SignedOutState title="Log in to manage your profile" />
    );
  }

  const userData = await userResponse.json();
  const user = userData.user;

  if (!user || !["student", "tutor"].includes(user.role)) {
    return (
      <SignedOutState title="Log in to manage your profile" />
    );
  }

  const fullName = user.fullName || user.full_name || "User";

  let profile = null;
  let subjects = [];

  if (user.role === "tutor") {
    const profileResponse = await fetch(
      `${API_URL}/api/tutors/me/profile`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      profile = profileData.profile || null;
    } else if (profileResponse.status !== 404) {
      throw new Error("Unable to load tutor profile.");
    }
  }

  // Subjects are not stored in a separate table in
  // the current TuLinkUp database schema.
  // ProfileForm can receive an empty array until
  // subject options are implemented.

  const normalizedUser = {
    ...user,
    fullName,
  };

  return (
    <DashboardShell role={user.role} name={fullName}>
      <p className="eyebrow">Account settings</p>

      <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">
        Manage your profile
      </h1>

      <p className="mt-2 text-[#71809a]">
        Keep your personal and professional information up to date.
      </p>

      <div className="mt-8">
        <ProfileForm
          user={normalizedUser}
          profile={profile}
          subjects={subjects}
        />
      </div>
    </DashboardShell>
  );
}
