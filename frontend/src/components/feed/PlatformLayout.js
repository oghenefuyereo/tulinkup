import Link from "next/link";

import FeedSidebar from "./FeedSidebar";
import { FeedRightSidebar } from "./FeedRightSidebar";
import { MobileNav } from "../MobileNav";

import { getPlatformData } from "@/lib/platformData";

// Shared layout for the main TuLinkUp platform pages.
export default async function PlatformLayout({ children }) {
  // Retrieve public marketplace information.
  const feedProps = await getPlatformData();

  return (
    <>
      <div className="min-h-screen bg-[#f7f9fd]">
        <div className="mx-auto max-w-[1440px] px-3 pt-5 pb-4 sm:px-6 md:pb-24 lg:px-8 lg:py-8">

          <div className="grid items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_300px]">

            {/* Shared desktop navigation. */}
            <FeedSidebar />

            {/* Content of the current page. */}
            <div className="@container/platform min-w-0 space-y-5">
              {children}

              {/* Legal links when the right sidebar is hidden. */}
              <footer className="px-2 pb-6 text-xs leading-6 text-[#68758c] xl:hidden">
                <nav
                  aria-label="Footer links"
                  className="flex flex-wrap gap-4"
                >
                  <Link href="/#how-it-works">
                    About
                  </Link>

                  <Link href="/terms">
                    Terms of Service
                  </Link>

                  <Link href="/privacy">
                    Privacy Policy
                  </Link>
                </nav>

                <p className="mt-3">
                  © 2026 Inovenatic Group. All rights reserved.
                </p>
              </footer>
            </div>

            {/* Shared marketplace recommendations. */}
            <FeedRightSidebar {...feedProps} />

          </div>
        </div>
      </div>

      {/* Shared mobile navigation. */}
      <MobileNav />
    </>
  );
}
