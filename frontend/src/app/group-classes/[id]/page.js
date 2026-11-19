
import GroupClassDetails from "@/components/GroupClassDetails";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Group Class Details",
  description:
    "View group class information and enrol on TuLinkUp.",
};

export default async function GroupClassDetailsPage({
  params,
}) {
  const { id } = await params;

  if (!/^\d+$/.test(String(id))) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f7f9fd]">
      <div className="page-wrap py-10">
        <GroupClassDetails
          key={id}
          classId={id}
        />
      </div>
    </main>
  );
}
