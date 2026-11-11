
import "./globals.css";
import { Header } from "@/components/Header";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "TuLinkUp — Find the right tutor",
    template: "%s | TuLinkUp",
  },

  description:
    "Connect with qualified tutors, build confidence, and reach your learning goals.",

  robots: {
    index: true,
    follow: true,
  },

  icons: {
    icon: "/favicon.ico",
  },

  openGraph: {
    title: "TuLinkUp — Find the right tutor",
    description:
      "Connect with qualified tutors, build confidence, and reach your learning goals.",
    type: "website",
    siteName: "TuLinkUp",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-[#17233d] antialiased">
        <div id="root">
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}
