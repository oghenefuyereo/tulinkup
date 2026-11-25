
import GroupClassDiscovery from "@/components/GroupClassDiscovery";

export const metadata = {
  title: "Group Live Classes",
  description:
    "Discover affordable group learning sessions with tutors on TuLinkUp.",
};

export default function GroupClassesPage() {
  return (
    <main className="min-h-screen bg-[#f7f9fd]">
      {/* Compact page heading */}
      <section className="mb-5 px-1 pt-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#17233d] sm:text-4xl">
          Group classes
        </h1>

        <p className="mt-2 text-sm leading-6 text-[#68758c] sm:text-base">
          Learn together with affordable live classes.
        </p>
      </section>

      {/* Marketplace */}
      <section className="w-full py-5">
        <GroupClassDiscovery />
      </section>
    </main>
  );
}
