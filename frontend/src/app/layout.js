import { Header } from "@/components/Header";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const title = "TuLinkUp — Find the right tutor";

const description =
  "Connect with qualified tutors, build confidence, and reach your learning goals.";

export const metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: title,
    template: "%s | TuLinkUp",
  },

  description,

  applicationName: "TuLinkUp",

  robots: {
    index: true,
    follow: true,
  },

  icons: {
    icon: "/favicon.svg",
  },

  openGraph: {
    type: "website",
    siteName: "TuLinkUp",
    title,
    description,
    url: siteUrl,
    // Add an image after creating /public/og-image.png.
    // images: ["/og-image.png"],
  },

  twitter: {
    card: "summary",
    title,
    description,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-[#17233d] antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3"
        >
          Skip to content
        </a>

        <Header />

        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
      </body>
    </html>
  );
}