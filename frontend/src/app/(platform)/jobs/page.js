import Link from "next/link";
import { Icon } from "@/components/Icons";


export const metadata = {
  title: "Jobs — Coming Soon",
  description:
    "Discover upcoming career opportunities on TuLinkUp.",
};

export default function JobsPage() {
  return (
    <>
      <main className="min-h-[75vh] bg-[#f7f9fd]">
        <section className="w-full py-4">
          <div className="panel mx-auto max-w-2xl px-5 py-10 text-center @min-[600px]/platform:px-10">

            <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-[#edf1fa] text-[#26469b]">
              <Icon name="briefcase" className="h-10 w-10" />
            </div>

            <p className="eyebrow mt-7">
              TuLinkUp Jobs
            </p>

            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-[#173472] sm:text-5xl">
              Coming Soon
            </h1>

            <div className="mx-auto mt-5 h-1 w-16 rounded-full bg-[#f5c518]" />

            <p className="mx-auto mt-6 max-w-lg text-base leading-7 text-[#68758c]">
              Discover career opportunities, internships,
              and graduate positions. We are building
              a new way to connect your skills
              with your future.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 @min-[480px]/platform:flex-row">
              <Link
                href="/courses"
                className="btn-primary"
              >
                Explore courses
              </Link>

              <Link
                href="/"
                className="btn-secondary"
              >
                Back to home
              </Link>
            </div>

          </div>
        </section>
      </main>

    </>
  );
}
