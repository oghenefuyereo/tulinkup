
// Import Link to allow navigation between pages in Next.js.
import Link from "next/link";

// Set the page title and description for the tutor availability page.
export const metadata = {
  title: "Tutor Availability | TuLinkUp",
  description: "Manage your tutoring availability on TuLinkUp.",
};

// Create the page where tutors will manage their teaching schedules.
export default function AvailabilityPage() {
  return (
    // Main container for the tutor availability page.
    <main className="min-h-screen bg-[#f7f9fd] px-5 py-12 text-[#17233d]">
      <div className="mx-auto max-w-5xl">
        {/* Provide a link back to the TuLinkUp homepage. */}
        <Link
          href="/"
          className="text-sm font-bold text-[#26469b]"
        >
          ← Back to homepage
        </Link>

        {/* Display the page heading and introduction. */}
        <div className="mt-8">
          <p className="text-sm font-extrabold uppercase tracking-widest text-[#26469b]">
            TuLinkUp Tutor Dashboard
          </p>

          {/* Show the main heading for managing availability. */}
          <h1 className="mt-3 text-3xl font-extrabold">
            Manage Your Availability
          </h1>

          {/* Explain why tutors need to set their teaching schedules. */}
          <p className="mt-3 text-[#68758c]">
            Set your teaching schedule so students can
            find available times and book tutoring sessions.
          </p>
        </div>

        {/* Display the section for the tutor's teaching schedule. */}
        <section className="mt-8 rounded-2xl border border-[#e5e9f0] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">
            Your Teaching Schedule
          </h2>

          {/* Explain that schedules will appear after backend integration. */}
          <p className="mt-3 text-[#68758c]">
            Your available dates and times will appear
            here once the schedule management form is
            connected to your TuLinkUp backend.
          </p>

          {/* Show a placeholder when no teaching schedule is displayed. */}
          <div className="mt-6 rounded-xl bg-[#f7f9fd] p-5">
            <p className="text-sm font-semibold text-[#52617b]">
              No schedule displayed yet.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
