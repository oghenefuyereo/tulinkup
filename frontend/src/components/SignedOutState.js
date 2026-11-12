
// Import Link to navigate users to the login page.
import Link from "next/link";

// Import the reusable icon component.
import { Icon } from "./Icons";

// Create a reusable message for users who are not logged in.
export function SignedOutState({
  // Set a default heading that can be customized when needed.
  title = "Log in to view your dashboard",
}) {
  // Display the signed-out message and login button.
  return (
    // Main container for the signed-out page.
    <main className="min-h-[70vh] bg-[#f7f9fd] px-5 py-20">
      {/* Center the message inside a styled panel. */}
      <div className="panel mx-auto max-w-lg p-10 text-center">
        {/* Display a user icon above the message. */}
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#edf1fa] text-[#26469b]">
          <Icon name="user" className="h-8 w-8" />
        </span>

        {/* Display the login heading. */}
        <h1 className="mt-5 text-2xl font-extrabold">
          {title}
        </h1>

        {/* Explain why the user needs to log in. */}
        <p className="mt-3 text-[#68758c]">
          Your bookings and profile are protected by your
          TuLinkUp account.
        </p>

        {/* Provide a link to the login page. */}
        <Link
          href="/login"
          className="btn-primary mt-7"
        >
          Log in securely
        </Link>
      </div>
    </main>
  );
}
