
// Import Link to navigate between pages in Next.js.
import Link from "next/link";

// Import the TuLinkUp logo.
import { Logo } from "./Logo";

// Create the footer displayed at the bottom of the website.
export function Footer() {
  return (
    // Main footer container with background colour and spacing.
    <footer className="bg-[#112b64] pb-24 pt-14 text-white md:pb-10">
      {/* Organize the footer content into responsive columns. */}
      <div className="page-wrap grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        {/* Display the TuLinkUp logo and platform description. */}
        <div>
          <Logo light />

          {/* Explain what TuLinkUp is and identify its parent company. */}
          <p className="mt-5 max-w-sm text-sm leading-6 text-blue-100/75">
            Learn. Practice. Build. Connect. Grow. TuLinkUp is an
            educational technology platform by Inovenatic Group.
          </p>
        </div>

        {/* Display links related to the tutoring marketplace. */}
        <div>
          <h3 className="font-bold">Marketplace</h3>

          <div className="mt-4 flex flex-col gap-3 text-sm text-blue-100/75">
            {/* Link to the tutor discovery page. */}
            <Link href="/tutors">Find a tutor</Link>

            {/* Link to the tutor registration page. */}
            <Link href="/register?role=tutor">Become a tutor</Link>

            {/* Link to the subjects section on the homepage. */}
            <Link href="/#subjects">Subjects</Link>
          </div>
        </div>

        {/* Display links to information about TuLinkUp. */}
        <div>
          <h3 className="font-bold">Company</h3>

          <div className="mt-4 flex flex-col gap-3 text-sm text-blue-100/75">
            {/* Explain how the tutoring platform works. */}
            <Link href="/#how-it-works">How it works</Link>

            {/* Link to the success stories section. */}
            <Link href="/#testimonials">Success stories</Link>

            {/* Link to the homepage for information about TuLinkUp. */}
            <Link href="/">About TuLinkUp</Link>
          </div>
        </div>

        {/* Display links related to user support. */}
        <div>
          <h3 className="font-bold">Support</h3>

          <div className="mt-4 flex flex-col gap-3 text-sm text-blue-100/75">
            {/* Link to the current help centre placeholder. */}
            <Link href="/login">Help centre</Link>

            {/* Link to the current contact page placeholder. */}
            <Link href="/login">Contact</Link>

            {/* Link to the current safety information placeholder. */}
            <Link href="/login">Safety</Link>
          </div>
        </div>
      </div>

      {/* Display the copyright information at the bottom of the footer. */}
      <div className="page-wrap mt-12 border-t border-white/10 pt-6 text-xs text-blue-100/60">
        © 2026 Inovenatic Group. All rights reserved.
      </div>
    </footer>
  );
}
