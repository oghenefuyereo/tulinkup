
import Link from "next/link";
import Image from "next/image";

export function Logo({ light = false }) {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5"
      aria-label="TuLinkUp home"
    >
      {/* Actual TuLinkUp SVG logo */}
      <Image
        src="/images/logo.svg"
        alt=""
        width={44}
        height={44}
        priority
        className="h-10 w-10 object-contain sm:h-11 sm:w-11"
      />

      {/* TuLinkUp brand name */}
      <span
        className={`text-xl font-bold tracking-[-0.03em] sm:text-2xl ${
          light ? "text-white" : "text-[#173472]"
        }`}
      >
        Tu
        <span className="text-[#f5c518]">
          Link
        </span>
        Up
      </span>
    </Link>
  );
}
