"use client";

import { usePathname } from "next/navigation";
import { isPlatformLinkActive } from "@/lib/platformRoutes";

import Link from "next/link";
import { Icon } from "../Icons";
import { useUnreadMessages } from "@/context/UnreadMessagesContext";
import UnreadMessageBadge from "@/components/messaging/UnreadMessageBadge";

// Navigation for the TuLinkUp learning feed.
const navigation = [
  {
    label: "Home",
    href: "/",
    icon: "home",

  },
  {
    label: "Find a tutor",
    href: "/tutors",
    icon: "search",
  },
  {
    label: "Group classes",
    href: "/group-classes",
    icon: "calendar",
  },
  {
    label: "Courses",
    href: "/courses",
    icon: "courses",
    comingSoon: true,
  },
  {
    label: "Community",
    icon: "user",
    comingSoon: true,
  },
  {
    label: "Jobs",
    href: "/jobs",
    icon: "briefcase",
    comingSoon: true,
  },
  {
    label: "Messages",
    href: "/messages",
    icon: "message",
  },
  {
    label: "Saved posts",
    icon: "bookmark",
    comingSoon: true,
  },
  {
    label: "My profile",
    href: "/profile",
    icon: "user",
  },
];

export default function FeedSidebar() {
  const pathname = usePathname();
  const { unreadCount } = useUnreadMessages();
  return (
    <aside className="hidden min-w-0 lg:sticky lg:top-24 lg:block lg:self-start lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto">
      <div className="space-y-4">
        <div className="rounded-2xl border border-[#e3e7ef] bg-white p-4">
          <h2 className="mb-4 px-3 text-base font-bold text-[#173472]">
            Menu
          </h2>

          <nav
            aria-label="Learning feed navigation"
            className="space-y-1"
          >
            {navigation.map((item) => {
              const active = isPlatformLinkActive(
                pathname,
                item.href
              );
              const content = (
                <>
                  <Icon
                    name={item.icon}
                    className="h-5 w-5 shrink-0"
                  />

                  <span className="min-w-0 flex-1">
                    {item.label}
                  </span>

                  {item.href === "/messages" && (
                    <UnreadMessageBadge
                      count={unreadCount}
                    />
                  )}

                  {item.comingSoon && (
                    <span className="text-[10px] font-medium">
                      Soon
                    </span>
                  )}
                </>
              );

              if (item.comingSoon) {
                return (
                  <div
                    key={item.label}
                    aria-disabled="true"
                    title="Coming soon"
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500"
                  >
                    {content}
                  </div>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-label={
                    item.href === "/messages" &&
                    unreadCount > 0
                      ? `Messages, ${unreadCount} unread`
                      : undefined
                  }
                  aria-current={
                    active ? (pathname === item.href ? "page" : "location") : undefined
                  }
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-[#edf1fa] text-[#26469b]"
                      : "text-[#334155] hover:bg-[#f5f7fb]"
                  }`}
                >
                  {content}
                </Link>
              );
            })}
          </nav>

          <div className="mt-5 border-t border-[#e7eaf1] pt-5">
            <div className="rounded-xl bg-[#26469b] p-4 text-white">
              <div className="mb-3 h-1 w-10 rounded-full bg-[#f5c518]" />

              <p className="text-sm font-bold leading-6">
                Learn. Practice. Build. Connect. Grow.
              </p>

              <p className="mt-2 text-xs leading-5 text-blue-100">
                Your learning journey starts here.
              </p>
            </div>
          </div>
        </div>

        <div className="px-3 text-xs leading-6 text-slate-500">
          <div className="flex flex-wrap gap-x-3">
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>

            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
          </div>

          <p className="mt-2">
            © 2026 TuLinkUp
          </p>

          <p>By Inovenatic Group</p>
        </div>
      </div>
    </aside>
  );
}
