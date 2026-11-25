
// Import cookies to access the user's authentication token.
import { cookies } from "next/headers";

// Import the components used to display and manage user profiles.
import { DashboardShell } from "@/components/DashboardShell";
import { ProfileForm } from "@/components/ProfileForm";
import { SignedOutState } from "@/components/SignedOutState";

// Make sure the page loads fresh information for each request.
export const dynamic = "force-dynamic";

// Set the Express backend URL for authentication and profile requests.
const API_URL = process.env.API_URL || "http://localhost:5001";

// Create the profile management page for students and tutors.
export default async function ProfilePage() {
  // Read the user's authentication token from the stored cookie.
  const cookieStore = await cookies();
  const token = cookieStore.get("tulinkup_token")?.value;

  // Ask the user to log in if no authentication token is found.
  if (!token) {
    return (
      <SignedOutState title="Log in to manage your profile" />
    );
  }

  // Verify the user's account through the Express backend.
  const userResponse = await fetch(`${API_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  // Show the login message if authentication fails.
  if (!userResponse.ok) {
    return (
      <SignedOutState title="Log in to manage your profile" />
    );
  }

  // Read the authenticated user's account information.
  const userData = await userResponse.json();
  const user = userData.user;

  // Allow only student and tutor accounts to manage their profiles.
  if (!user || !["student", "tutor"].includes(user.role)) {
    return (
      <SignedOutState title="Log in to manage your profile" />
    );
  }

  // Get the user's full name or use a default name if unavailable.
  const fullName = user.fullName || user.full_name || "User";

  // Prepare variables for the tutor profile and subject options.
  let profile = null;
  let subjects = [];

  // Load additional profile information for tutor accounts.
  if (user.role === "tutor") {
    // Request the tutor's professional profile from the backend.
    const profileResponse = await fetch(
      `${API_URL}/api/tutors/me/profile`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    // Store the tutor's profile if the request is successful.
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      profile = profileData.profile || null;

    // Allow tutors to continue if they have not created a profile yet.
    } else if (profileResponse.status !== 404) {
      // Stop loading if an unexpected profile error occurs.
      throw new Error("Unable to load tutor profile.");
    }
  }

  // Subjects are not stored in a separate table in
  // the current TuLinkUp database schema.
  // ProfileForm can receive an empty array until
  // subject options are implemented.

  // Prepare the user's information in the format expected by ProfileForm.
  const normalizedUser = {
    ...user,
    fullName,
  };

  // Display the profile page inside the appropriate dashboard layout.
  return (
    <DashboardShell role={user.role} name={fullName}>
      {/* Display the page heading and introduction. */}
      <p className="eyebrow">Account settings</p>

      <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">
        Manage your profile
      </h1>

      {/* Explain the purpose of the profile management page. */}
      <p className="mt-2 text-[#71809a]">
        Keep your personal and professional information up to date.
      </p>

      {/* Display the form for editing student or tutor profile details. */}
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
