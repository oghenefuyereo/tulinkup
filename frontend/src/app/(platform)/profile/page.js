import Link from "next/link";
import StudentProfileView from "@/components/StudentProfileView";
import StudentAccountSettings from "@/components/StudentAccountSettings";
import TutorProfileContent, {
  getTutorBySlug,
} from "@/components/TutorProfileContent";

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
export default async function ProfilePage({
  searchParams,
}) {
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
  let ownAvailability = null;

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

      ownAvailability =
        Array.isArray(profileData.availability)
          ? profileData.availability
          : null;

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


  // Resolve the requested profile view for both account roles.
  const query = await searchParams;
  const view = query?.view;

  // Display the redesigned profile for student accounts only.
  if (user.role === "student") {
    return (
      <DashboardShell role={user.role} name={fullName}>
        <StudentProfileView
          fullName={fullName}
          email={normalizedUser.email}
          view={
            view === "edit" || view === "settings"
              ? view
              : "profile"
          }
        >
          <ProfileForm
            user={normalizedUser}
            profile={profile}
            subjects={subjects}
          />
        </StudentProfileView>
      </DashboardShell>
    );
  }




  if (view === "edit") {
    return (
      <DashboardShell role={user.role} name={fullName}>
        <div className="min-w-0 space-y-5">
          <Link
            href="/profile"
            className="inline-block text-sm font-bold text-[#52617b] hover:text-[#26469b]"
          >
            ← Back to my profile
          </Link>

          <div>
            <p className="eyebrow">Tutor profile</p>

            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
              Edit profile
            </h1>

            <p className="mt-2 text-sm text-[#68758c]">
              Update your professional information.
            </p>
          </div>

          <ProfileForm
            user={normalizedUser}
            profile={profile}
            subjects={subjects}
            returnToProfile
          />

          <p className="text-xs text-[#68758c]">
            Profile picture changes are saved immediately.
            Cancel discards unsaved form changes.
          </p>
        </div>
      </DashboardShell>
    );
  }

  if (view === "settings") {
    return (
      <DashboardShell role={user.role} name={fullName}>
        <StudentAccountSettings
          email={normalizedUser.email}
          role="tutor"
        >
          <ProfileForm
            user={normalizedUser}
            profile={profile}
            accountOnly
          />
        </StudentAccountSettings>
      </DashboardShell>
    );
  }

  // Use the authenticated tutor's own profile.
  // Do not require public approval to view it.
  const slug =
    typeof profile?.slug === "string"
      ? profile.slug
      : "";

  let publicTutor = null;

  // Use the authenticated tutor's own saved schedule.
  // Reviews remain empty until review integration.
  const extras = {
    reviews: [],
    availability: ownAvailability ?? [],
  };

  const extrasUnavailable = ownAvailability === null;

  if (slug) {
    try {
      const published = await getTutorBySlug(slug);

      if (published) {
        const accountId = user.id ?? user.userId;

        if (
          accountId != null &&
          published.userId != null &&
          String(published.userId) === String(accountId)
        ) {
          publicTutor = published;
        }
      }
    } catch {
      // Public profile metadata is optional.
      // Private availability remains independent.
    }
  }

  const imageUrl =
    profile?.image?.url ||
    profile?.profileImageUrl ||
    profile?.profile_image_url ||
    publicTutor?.image?.url ||
    null;

  const tutor = {
    ...publicTutor,
    ...profile,

    name:
      profile?.displayName ||
      profile?.display_name ||
      publicTutor?.name ||
      fullName,

    image: imageUrl
      ? { url: imageUrl, alt: fullName }
      : null,

    biography:
      profile?.bio ??
      profile?.biography ??
      publicTutor?.biography ??
      "",

    hourlyRate:
      profile?.hourlyRate ??
      profile?.hourly_rate ??
      publicTutor?.hourlyRate ??
      null,

    availabilityStatus:
      profile?.availabilityStatus ??
      profile?.availability_status ??
      publicTutor?.availabilityStatus,

    reviewCount:
      profile?.reviewCount ??
      profile?.review_count ??
      publicTutor?.reviewCount,

    verified: publicTutor?.verified === true,
  };

  return (
    <DashboardShell role={user.role} name={fullName}>
      <TutorProfileContent
        tutor={tutor}
        extras={extras}
        slug={slug}
        owner
        extrasUnavailable={extrasUnavailable}
      />
    </DashboardShell>
  );
}
