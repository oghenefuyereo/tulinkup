import MessagingWorkspace from "@/components/messaging/MessagingWorkspace";

export const metadata = {
  title: "Messages | TuLinkUp",
  description: "Connect with your tutors and students.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function MessagesPage({ searchParams }) {
  const params = await searchParams;
  const requestedId = params?.conversation;

  const initialConversationId =
    typeof requestedId === "string" &&
    /^[1-9]\\d{0,18}$/.test(requestedId) &&
    BigInt(requestedId) <= 9223372036854775807n
      ? requestedId
      : null;

  return (
    <section className="min-w-0 space-y-5">
      <div className="px-1 pt-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#17233d] sm:text-4xl">
          Messages
        </h1>

        <p className="mt-2 text-sm leading-6 text-[#68758c] sm:text-base">
          Connect with your tutors and students.
        </p>
      </div>

      <MessagingWorkspace
        initialConversationId={initialConversationId}
      />
    </section>
  );
}
