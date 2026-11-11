
import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="bg-[#112b64] pb-24 pt-14 text-white md:pb-10">
      <div className="page-wrap grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-5 max-w-sm text-sm leading-6 text-blue-100/75">
            Learn. Practice. Build. Connect. Grow. TuLinkUp is an
            educational technology platform by Inovenatic Group.
          </p>
        </div>

        <div>
          <h3 className="font-bold">Marketplace</h3>
          <div className="mt-4 flex flex-col gap-3 text-sm text-blue-100/75">
            <Link href="/tutors">Find a tutor</Link>
            <Link href="/register?role=tutor">Become a tutor</Link>
            <Link href="/#subjects">Subjects</Link>
          </div>
        </div>

        <div>
          <h3 className="font-bold">Company</h3>
          <div className="mt-4 flex flex-col gap-3 text-sm text-blue-100/75">
            <Link href="/#how-it-works">How it works</Link>
            <Link href="/#testimonials">Success stories</Link>
            <Link href="/">About TuLinkUp</Link>
          </div>
        </div>

        <div>
          <h3 className="font-bold">Support</h3>
          <div className="mt-4 flex flex-col gap-3 text-sm text-blue-100/75">
            <Link href="/login">Help centre</Link>
            <Link href="/login">Contact</Link>
            <Link href="/login">Safety</Link>
          </div>
        </div>
      </div>

      <div className="page-wrap mt-12 border-t border-white/10 pt-6 text-xs text-blue-100/60">
        © 2026 Inovenatic Group. All rights reserved.
      </div>
    </footer>
  );
}
