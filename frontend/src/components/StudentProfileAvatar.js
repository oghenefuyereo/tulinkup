"use client";

import Image from "next/image";
import { useState } from "react";

function PrivateImage({ version }) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <Image
      src={`/api/profile/student/image?v=${version}`}
      alt="Your profile picture"
      width={112}
      height={112}
      unoptimized
      className="absolute inset-0 h-full w-full object-cover object-[center_20%]"
      onError={() => setFailed(true)}
    />
  );
}

export default function StudentProfileAvatar({
  initials,
  hasProfileImage,
  version = 0,
  size = "large",
}) {
  const dimensions =
    size === "small"
      ? "h-20 w-20 text-2xl"
      : "h-24 w-24 text-3xl sm:h-28 sm:w-28";

  return (
    <div
      aria-label="Student profile avatar"
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#e8eefb] font-extrabold text-[#26469b] ${dimensions}`}
    >
      <span>{initials || "S"}</span>

      {hasProfileImage && (
        <PrivateImage
          key={version}
          version={version}
        />
      )}
    </div>
  );
}
