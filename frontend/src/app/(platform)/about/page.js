import Link from "next/link";

export const metadata = {
  title: "About TuLinkUp",
  description: "Learn more about the TuLinkUp learning community.",
};

export default function AboutPage() {
  return (
    <main className="min-w-0 space-y-5">
      <section
                id="how-it-works"
                className="panel scroll-mt-24 p-5"
              >
                <h2 className="text-lg font-extrabold text-[#17233d]">
                  About TuLinkUp
                </h2>

                <p className="mt-3 text-sm leading-6 text-[#68758c]">
                  TuLinkUp connects students and tutors
                  through personalized tutoring, group
                  classes and a growing learning community.
                </p>

                <p className="mt-3 text-sm font-bold text-[#26469b]">
                  Learn. Practice. Build. Connect. Grow.
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href="/tutors"
                    className="btn-primary px-4 py-2 text-sm"
                  >
                    Find a tutor
                  </Link>

                  <Link
                    href="/register?role=tutor"
                    className="btn-secondary px-4 py-2 text-sm"
                  >
                    Become a tutor
                  </Link>
                </div>
              </section>
    </main>
  );
}
