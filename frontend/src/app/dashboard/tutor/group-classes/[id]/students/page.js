
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function GroupClassStudentsPage() {
  const { id } = useParams();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadStudents() {
      try {
        const response = await fetch(
          `/api/group-classes/${id}/students`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to load students."
          );
        }

        if (!controller.signal.aborted) {
          setStudents(data.students || []);
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

    loadStudents();

    return () => controller.abort();
  }, [id]);

  return (
    <main className="min-h-screen bg-[#f7f9fd]">
      <div className="page-wrap space-y-6 py-8">
        <Link
          href="/dashboard/tutor/group-classes"
          className="text-sm font-bold text-[#26469b]"
        >
          ← Back to group classes
        </Link>

        <div>
          <h1 className="text-3xl font-extrabold text-[#17233d]">
            Enrolled Students
          </h1>

          <p className="mt-2 text-sm text-[#64748b]">
            View students registered for your group class.
          </p>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        ) : loading ? (
          <div className="panel p-10 text-center">
            Loading students...
          </div>
        ) : (
          <>
            <div className="panel p-6">
              <p className="text-sm text-[#64748b]">
                Total enrolment records
              </p>

              <p className="mt-2 text-3xl font-extrabold">
                {students.length}
              </p>
            </div>

            {students.length === 0 ? (
              <div className="panel p-10 text-center">
                <h2 className="text-xl font-extrabold">
                  No students enrolled yet
                </h2>

                <p className="mt-2 text-sm text-[#64748b]">
                  Students will appear here after enrolling.
                </p>
              </div>
            ) : (
              <div className="panel overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f0f4fa]">
                    <tr>
                      <th className="p-4">Student</th>
                      <th className="p-4">Enrollment</th>
                      <th className="p-4">Payment</th>
                      <th className="p-4">Date enrolled</th>
                    </tr>
                  </thead>

                  <tbody>
                    {students.map((student) => (
                      <tr
                        key={student.enrollment_id}
                        className="border-t border-[#edf0f5]"
                      >
                        <td className="p-4 font-bold">
                          {student.full_name}
                        </td>

                        <td className="p-4 capitalize">
                          {student.enrollment_status}
                        </td>

                        <td className="p-4 capitalize">
                          {student.payment_status?.replaceAll(
                            "_",
                            " "
                          )}
                        </td>

                        <td className="p-4">
                          {new Date(
                            student.enrolled_at
                          ).toLocaleDateString("en-CA")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
