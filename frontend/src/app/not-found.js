
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[#f7f9fd] px-6 py-20">
      <div className="mx-auto max-w-xl text-center">
        <div className="mb-6 text-7xl font-extrabold tracking-[-.06em] text-[#26469b] sm:text-8xl">
          404
        </div>

        <span className="inline-flex rounded-full bg-[#e9f8ef] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-[#118447]">
          Page not found
        </span>

        <h1 className="mt-6 text-3xl font-extrabold tracking-[-.04em] text-[#17233d] sm:text-4xl">
          Looks like this lesson is missing.
        </h1>

        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-[#68758c]">
          The page you&apos;re looking for doesn&apos;t exist,
          has been moved, or is no longer available.
          You can return home or explore available tutors.
        </p>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="btn-primary flex items-center justify-center px-7 py-3"
          >
            Back to homepage
          </Link>

          <Link
            href="/tutors"
            className="btn-secondary flex items-center justify-center px-7 py-3"
          >
            Find a tutor
          </Link>
        </div>

        <p className="mt-12 text-sm font-medium text-[#8a95a8]">
          TuLinkUp — Learn. Practice. Build. Connect. Grow.
        </p>
      </div>
    </main>
  );
}
