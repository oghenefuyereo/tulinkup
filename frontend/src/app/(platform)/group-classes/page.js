
import GroupClassDiscovery from "@/components/GroupClassDiscovery";
import Link from "next/link";

export const metadata = {
  title: "Group Live Classes",
  description:
    "Discover affordable group learning sessions with tutors on TuLinkUp.",
};

export default function GroupClassesPage() {
  return (
    <main className="min-h-screen bg-[#f7f9fd]">
      {/* Hero section */}
      <section className="bg-[#173472] text-white">
        <div className="w-full px-4 py-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-widest text-blue-200">
              TuLinkUp Group Learning
            </p>

            <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">
              Learn Together. Spend Less. Achieve More.
            </h1>

            <p className="mt-5 text-lg leading-8 text-blue-100">
              Join affordable live group classes, learn
              alongside other students, and build your
              confidence with experienced tutors.
            </p>

            <Link
              href="/tutors"
              className="mt-6 inline-block rounded-xl border border-white/40 px-5 py-3 text-sm font-bold hover:bg-white/10"
            >
              Prefer one-on-one tutoring?
            </Link>
          </div>
        </div>
      </section>

      {/* Marketplace */}
      <section className="w-full py-5">
        <GroupClassDiscovery />
      </section>
    </main>
  );
}
