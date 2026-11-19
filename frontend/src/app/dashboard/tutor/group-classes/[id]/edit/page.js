
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import GroupClassForm from "@/components/GroupClassForm";

export default function EditGroupClassPage() {
  const { id } = useParams();

  const [groupClass, setGroupClass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadClass() {
      try {
        const response = await fetch(
          "/api/group-classes/me",
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to load class."
          );
        }

        const selectedClass = data.classes.find(
          (item) => String(item.id) === String(id)
        );

        if (!selectedClass) {
          throw new Error("Group class not found.");
        }

        if (selectedClass.status !== "draft") {
          throw new Error(
            "Only draft classes can be edited."
          );
        }

        if (!controller.signal.aborted) {
          setGroupClass(selectedClass);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadClass();

    return () => controller.abort();
  }, [id]);

  return (
    <main className="min-h-screen bg-[#f7f9fd]">
      <div className="page-wrap py-8">
        <div className="mx-auto max-w-4xl">
          {loading ? (
            <div className="panel p-10 text-center">
              Loading group class...
            </div>
          ) : error ? (
            <div className="panel space-y-4 p-8">
              <h1 className="text-xl font-extrabold">
                Unable to edit class
              </h1>

              <p className="text-sm text-red-600">
                {error}
              </p>

              <Link
                href="/dashboard/tutor/group-classes"
                className="text-sm font-bold text-[#26469b]"
              >
                Back to group classes
              </Link>
            </div>
          ) : (
            <GroupClassForm
              key={groupClass.id}
              initialClass={groupClass}
            />
          )}
        </div>
      </div>
    </main>
  );
}
