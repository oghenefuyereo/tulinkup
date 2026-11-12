
// Import the main website header.
import { Header } from "@/components/Header";

// Import the global styles used throughout TuLinkUp.
import "./globals.css";

// Set the website URL for development or production.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Define the default website title.
const title = "TuLinkUp — Find the right tutor";

// Define the website description for search engines and social media.
const description =
  "Connect with qualified tutors, build confidence, and reach your learning goals.";

// Set the website metadata for SEO and social media sharing.
export const metadata = {
  // Set the base URL used for metadata links.
  metadataBase: new URL(siteUrl),

  // Set the default page title and title format.
  title: {
    default: title,
    template: "%s | TuLinkUp",
  },

  // Add the website description.
  description,

  // Define the application name.
  applicationName: "TuLinkUp",

  // Allow search engines to index the website and follow links.
  robots: {
    index: true,
    follow: true,
  },

  // Set the website favicon.
  icons: {
    icon: "/favicon.svg",
  },

  // Set the information displayed when the website is shared.
  openGraph: {
    type: "website",
    siteName: "TuLinkUp",
    title,
    description,
    url: siteUrl,

    // Add an image after creating /public/og-image.png.
    // images: ["/og-image.png"],
  },

  // Set the information displayed when shared on Twitter/X.
  twitter: {
    card: "summary",
    title,
    description,
  },
};

// Create the main layout shared by all TuLinkUp pages.
export default function RootLayout({ children }) {
  return (
    // Set English as the website's main language.
    <html lang="en">
      <body className="min-h-screen bg-white text-[#17233d] antialiased">
        {/* Allow keyboard users to skip directly to the main content. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3"
        >
          Skip to content
        </a>

        {/* Display the main navigation header on every page. */}
        <Header />

        {/* Display the content of the current page. */}
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
      </body>
    </html>
  );
}
