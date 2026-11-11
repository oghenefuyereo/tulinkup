
import Link from "next/link";

export function Logo({ light = false }) {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5"
      aria-label="TuLinkUp home"
    >
      <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-[#26469b] text-white shadow-sm">
        <span className="absolute -top-1 h-3.5 w-7 rotate-0 border-x-[14px] border-b-[10px] border-x-transparent border-b-[#26469b]" />

        <span className="mt-1 text-[10px] font-extrabold">
          TU
        </span>
      </span>

      <span
        className={`text-xl font-bold tracking-[-0.03em] ${
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
