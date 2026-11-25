import { cache } from "react";

// Shared server-side marketplace data for TuLinkUp.

const API_URL = (
  process.env.API_URL || "http://localhost:5001"
).replace(/\/+$/, "");

// Preserve the original TuLinkUp subject categories.
const subjects = [
  "Mathematics",
  "Programming",
  "English",
  "Chemistry",
  "Physics",
  "Biology",
  "Graphic Design",
].map((name) => ({
  id: name,
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
}));

// Retrieve public information without exposing private data.
async function getPublicData(endpoint, key) {
  try {
    const response = await fetch(
      API_URL + endpoint,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      throw new Error("API returned " + response.status);
    }

    const data = await response.json();

    if (
      data.success === false ||
      !Array.isArray(data[key])
    ) {
      throw new Error("Invalid API response");
    }

    return {
      items: data[key],
      error: false,
    };
  } catch (error) {
    console.error(
      "Learning feed API error:",
      endpoint,
      error.message
    );

    return {
      items: [],
      error: true,
    };
  }
}

// Preserve existing group class pricing restrictions.
function hasValidClassPricing(groupClass) {
  if (!groupClass || groupClass.price_cents == null) {
    return false;
  }

  const price = Number(groupClass.price_cents);
  const capacity = Number(groupClass.maximum_students);
  const minimum = Number(groupClass.minimum_students);

  return (
    Number.isInteger(price) &&
    price >= 0 &&
    price <= 1000 &&
    Number.isInteger(capacity) &&
    capacity >= 2 &&
    capacity <= 20 &&
    Number.isInteger(minimum) &&
    minimum >= 1 &&
    minimum <= capacity &&
    price * capacity <= 10000 &&
    groupClass.currency === "CAD"
  );
}


export const getPlatformData = cache(async function getPlatformData() {

  // Load tutors and group classes concurrently.
  const [tutorResult, classResult] = await Promise.all([
    getPublicData("/api/tutors", "tutors"),
    getPublicData("/api/group-classes", "classes"),
  ]);

  const tutors = tutorResult.items
    .filter((tutor) => tutor && tutor.slug)
    .slice(0, 6);

  const classes = classResult.items
    .filter(hasValidClassPricing)
    .filter(
      (groupClass) =>
        new Date(groupClass.scheduled_at).getTime() >
        Date.now()
    )
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() -
        new Date(b.scheduled_at).getTime()
    )
    .slice(0, 6);

  const feedProps = {
    tutors,
    classes,
    subjects,
    tutorsError: tutorResult.error,
    classesError: classResult.error,
  };


  return feedProps;
});
