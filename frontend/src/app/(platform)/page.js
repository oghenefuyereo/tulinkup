import { getPlatformData } from "@/lib/platformData";
import { LearningFeed } from "@/components/feed/LearningFeed";

// Display the central TuLinkUp learning feed.
export default async function HomePage() {
  const feedProps = await getPlatformData();

  return (
    <main className="min-w-0 space-y-5">
      <LearningFeed {...feedProps} />

    </main>
  );
}
