
import Link from "next/link";
import { Icon } from "./Icons";

export function SignedOutState({
  title = "Log in to view your dashboard",
}) {
  return (
    <main className="min-h-[70vh] bg-[#f7f9fd] px-5 py-20">
      <div className="panel mx-auto max-w-lg p-10 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#edf1fa] text-[#26469b]">
          <Icon name="user" className="h-8 w-8" />
        </span>

        <h1 className="mt-5 text-2xl font-extrabold">
          {title}
        </h1>

        <p className="mt-3 text-[#68758c]">
          Your bookings and profile are protected by your
          TuLinkUp account.
        </p>

        <Link
          href="/login"
          className="btn-primary mt-7"
        >
          Log in securely
        </Link>
      </div>
    </main>
  );
}
