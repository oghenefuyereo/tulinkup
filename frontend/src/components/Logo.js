
// Import Link to navigate to the homepage.
import Link from "next/link";

// Import Image to display the TuLinkUp logo.
import Image from "next/image";

// Create a reusable logo component for the website.
export function Logo({ light = false }) {
  return (
    // Make the logo clickable so users can return to the homepage.
    <Link
      href="/"
      className="inline-flex items-center gap-2.5"
      aria-label="TuLinkUp home"
    >
      {/* Display the official TuLinkUp SVG logo. */}
      <Image
        // Set the location of the logo image.
        src="/images/logo.svg"

        // Use an empty alt because the link already has an accessible name.
        alt=""

        // Set the original image dimensions.
        width={44}
        height={44}

        // Load the logo early because it appears in the website header.
        priority

        // Adjust the logo size for different screen sizes.
        className="h-10 w-10 object-contain sm:h-11 sm:w-11"
      />

      {/* Display the TuLinkUp brand name beside the logo. */}
      <span
        className={`text-xl font-bold tracking-[-0.03em] sm:text-2xl ${
          // Use white text on dark backgrounds and blue text otherwise.
          light ? "text-white" : "text-[#173472]"
        }`}
      >
        {/* Display the first part of the brand name. */}
        Tu

        {/* Highlight "Link" using the brand's yellow colour. */}
        <span className="text-[#f5c518]">
          Link
        </span>

        {/* Display the last part of the brand name. */}
        Up
      </span>
    </Link>
  );
}
