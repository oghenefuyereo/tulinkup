
// Import Link to navigate between pages in Next.js.
import Link from "next/link";

// Import cookies to access the tutor's authentication token.
import { cookies } from "next/headers";

// Import redirect to send users to another page when necessary.
import { redirect } from "next/navigation";

// Import the components used to manage tutor availability.
import TutorAvailabilitySchedule from "@/components/TutorAvailabilitySchedule";
import { DashboardShell } from "@/components/DashboardShell";

// Make sure the page loads fresh information for each request.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tutor Availability",
  description: "Manage your tutoring availability on TuLinkUp.",
  robots: {
    index: false,
    follow: false,
  },
};

// Set the Express backend URL for API requests.
const API_URL = process.env.API_URL || "http://localhost:5001";

// Create a helper function for requesting protected data from the backend.
async function getProtectedData(
  path,
  token,
  { allowNotFound = false } = {}
) {
  // Send the authentication token with the API request.
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  // Stop the request if the backend returns an error.
  if (allowNotFound && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  // Return the JSON data received from the backend.
  return response.json();
}

// Create the page where tutors can manage their teaching availability.
export default async function AvailabilityPage() {
  // Read the tutor's authentication token from the stored cookie.
  const cookieStore = await cookies();
  const token = cookieStore.get("tulinkup_token")?.value;

  // Redirect users to the login page if they are not signed in.
  if (!token) {
    redirect("/login");
  }

  // Create a variable to store the authenticated user's information.
  let user;

  try {
    // Verify the user's login through the Express backend.
    const data = await getProtectedData("/api/auth/me", token);
    user = data.user;
  } catch {
    // Redirect to login if authentication cannot be verified.
    redirect("/login");
  }

  // Allow only authenticated tutor accounts to access this page.
  if (!user || user.role !== "tutor") {
    redirect("/login");
  }

  // Confirm the tutor has a professional profile.
  let profile = null;
  let loadError = false;

  try {
    const profileData = await getProtectedData(
      "/api/tutors/me/profile",
      token,
      { allowNotFound: true }
    );

    profile = profileData?.profile || null;
  } catch {
    loadError = true;
  }

  // Display the tutor availability page inside the dashboard layout.
  return (
    <DashboardShell role="tutor" name={user.full_name}>
      {/* Display an error if the availability information cannot load. */}
      {loadError ? (
        <div className="panel mt-8 p-8 text-center">
          <h2 className="text-xl font-bold">
            Unable to load availability
          </h2>

          <p className="mt-2 text-[#71809a]">
            Please try again later.
          </p>
        </div>

      // Show the availability manager when the tutor has a profile.
      ) : profile ? (
        <TutorAvailabilitySchedule />

      // Ask the tutor to create a profile before managing availability.
      ) : (
        <div className="panel mt-8 p-8 text-center">
          <h2 className="text-xl font-bold">
            Complete your tutor profile first
          </h2>

          <p className="mt-2 text-[#71809a]">
            Your availability needs a professional profile
            to connect to.
          </p>

          {/* Provide a link to the profile creation page. */}
          <Link href="/profile" className="btn-primary mt-6">
            Create profile
          </Link>
        </div>
      )}
    </DashboardShell>
  );
}
