
// Import Link to navigate between pages in Next.js.
import Link from "next/link";

// Import cookies to access the tutor's authentication token.
import { cookies } from "next/headers";

// Import redirect to send users to another page when necessary.
import { redirect } from "next/navigation";

// Import the components used to manage tutor availability.
import { AvailabilityManager } from "@/components/AvailabilityManager";
import { DashboardShell } from "@/components/DashboardShell";

// Make sure the page loads fresh information for each request.
export const dynamic = "force-dynamic";

// Set the Express backend URL for API requests.
const API_URL = process.env.API_URL || "http://localhost:5001";

// Create a helper function for requesting protected data from the backend.
async function getProtectedData(path, token) {
  // Send the authentication token with the API request.
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  // Stop the request if the backend returns an error.
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

  // Prepare variables for the tutor's profile and availability.
  let profile = null;
  let slots = [];
  let loadError = false;

  try {
    // Retrieve the tutor's professional profile from the backend.
    const profileData = await getProtectedData(
      "/api/tutors/me",
      token
    );

    // Store the tutor's profile if one exists.
    profile = profileData.profile || null;

    // Load availability only when the tutor has a profile.
    if (profile) {
      // Retrieve the tutor's available teaching time slots.
      const availabilityData = await getProtectedData(
        "/api/availability",
        token
      );

      // Store the available slots or use an empty list.
      slots = availabilityData.slots || [];
    }
  } catch {
    // Record an error if the profile or availability cannot be loaded.
    loadError = true;
  }

  // Display the tutor availability page inside the dashboard layout.
  return (
    <DashboardShell role="tutor" name={user.full_name}>
      {/* Display the page heading and introduction. */}
      <p className="eyebrow">Schedule settings</p>

      <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">
        Manage availability
      </h1>

      {/* Explain why tutors should keep their schedules updated. */}
      <p className="mt-2 text-[#71809a]">
        Keep your open times accurate so students only request
        sessions you can teach.
      </p>

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
        <div className="mt-8">
          <AvailabilityManager slots={slots} />
        </div>

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
