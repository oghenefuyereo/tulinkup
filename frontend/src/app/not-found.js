
// Import Link to navigate between pages in Next.js.
import Link from "next/link";

// Create the page displayed when a requested page cannot be found.
export default function NotFound() {
  return (
    // Main container for the 404 error page.
    <main className="flex min-h-[70vh] items-center justify-center bg-[#f7f9fd] px-6 py-20">
      <div className="mx-auto max-w-xl text-center">
        {/* Display the 404 error number. */}
        <div className="mb-6 text-7xl font-extrabold tracking-[-.06em] text-[#26469b] sm:text-8xl">
          404
        </div>

        {/* Show a label explaining that the page was not found. */}
        <span className="inline-flex rounded-full bg-[#e9f8ef] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-[#118447]">
          Page not found
        </span>

        {/* Display a friendly error message. */}
        <h1 className="mt-6 text-3xl font-extrabold tracking-[-.04em] text-[#17233d] sm:text-4xl">
          Looks like this lesson is missing.
        </h1>

        {/* Explain why the requested page may be unavailable. */}
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[#68758c]">
          The page you&apos;re looking for doesn&apos;t exist,
          has been moved, or is no longer available.
          You can return home or explore available tutors.
        </p>

        {/* Provide navigation options to help users continue browsing. */}
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          {/* Link back to the TuLinkUp homepage. */}
          <Link
            href="/"
            className="btn-primary flex items-center justify-center px-7 py-3"
          >
            Back to homepage
          </Link>

          {/* Link to the tutor discovery page. */}
          <Link
            href="/tutors"
            className="btn-secondary flex items-center justify-center px-7 py-3"
          >
            Find a tutor
          </Link>
        </div>

        {/* Display the TuLinkUp brand tagline. */}
        <p className="mt-12 text-sm font-medium text-[#8a95a8]">
          TuLinkUp — Learn. Practice. Build. Connect. Grow.
        </p>
      </div>
    </main>
  );
}
