import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import TutorProfileContent, {
  getTutorBySlug,
  getTutorExtras,
} from "@/components/TutorProfileContent";

export const dynamic = "force-dynamic";

const API_URL =
  process.env.API_URL || "http://localhost:5001";

async function isStudentVisitor() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tulinkup_token")?.value;

  if (!token) return false;

  try {
    const response = await fetch(
      `${API_URL}/api/auth/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) return false;

    const result = await response.json();

    return result?.user?.role === "student";
  } catch {
    return false;
  }
}

export default async function TutorProfilePage({
  params,
}) {
  const { slug } = await params;

  const tutor = await getTutorBySlug(slug);

  if (!tutor) notFound();

  const [extras, showVisitorActions] =
    await Promise.all([
      getTutorExtras(slug),
      isStudentVisitor(),
    ]);

  return (
    <TutorProfileContent
      tutor={tutor}
      extras={extras}
      slug={slug}
      showVisitorActions={showVisitorActions}
    />
  );
}
