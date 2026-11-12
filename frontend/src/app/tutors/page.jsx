
// Import Link to allow navigation between pages in Next.js.
import Link from "next/link";

// Create the page where students can explore available tutors.
export default function TutorsPage() {
  return (
    // Main container for the tutor discovery page.
    <main className="min-h-screen bg-[#f7f9fd] px-5 py-16 text-[#17233d]">
      <div className="mx-auto max-w-6xl">
        {/* Display the page heading and introduction. */}
        <div className="mb-10">
          <p className="text-sm font-bold uppercase tracking-widest text-[#26469b]">
            TuLinkUp Tutors
          </p>

          {/* Show the main heading for finding tutors. */}
          <h1 className="mt-3 text-4xl font-extrabold">
            Find Your Perfect Tutor
          </h1>

          {/* Explain how students can benefit from finding a tutor. */}
          <p className="mt-4 max-w-2xl text-[#68758c]">
            Connect with tutors who can help you learn,
            practice, build skills, and achieve your goals.
          </p>
        </div>

        {/* Display the section where tutor listings will appear. */}
        <div className="rounded-2xl border border-[#e5e9f0] bg-white p-10 text-center shadow-sm">
          <h2 className="text-2xl font-bold">
            Explore Our Tutors
          </h2>

          {/* Show a placeholder until tutor listings are connected to the API. */}
          <p className="mt-4 text-[#68758c]">
            Tutor listings will appear here once the
            frontend is connected to the TuLinkUp API.
          </p>

          {/* Provide a link back to the TuLinkUp homepage. */}
          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-[#26469b] px-6 py-3 font-bold text-white"
          >
            Back to Homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
