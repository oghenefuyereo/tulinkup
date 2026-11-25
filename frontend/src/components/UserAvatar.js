"use client";

import { useState } from "react";
import Image from "next/image";
import { Icon } from "./Icons";
import { useAuth } from "@/context/AuthContext";

// Reusable avatar for authenticated users and conversation participants.
export function ProfileAvatar({
  imageUrl = null,
  size = 44,
  className = "",
}) {
  const [failedUrl, setFailedUrl] = useState(null);

  // Only allow images from the existing profile image bucket.
  let validImage = false;

  if (typeof imageUrl === "string") {
    try {
      const url = new URL(imageUrl);

      validImage =
        url.protocol === "https:" &&
        url.hostname === "czlhnjdagetbgbzwrjmc.supabase.co" &&
        url.pathname.startsWith(
          "/storage/v1/object/public/profile-images/"
        ) &&
        !url.search &&
        !url.hash &&
        !url.port &&
        !url.username &&
        !url.password;
    } catch {
      validImage = false;
    }
  }

  const showImage =
    validImage &&
    failedUrl !== imageUrl;

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#edf1fa] text-[#26469b] ${className}`}
      style={{
        width: size,
        height: size,
      }}
      aria-hidden="true"
    >
      {showImage ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover object-top"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        <Icon
          name="user"
          className="h-[55%] w-[55%]"
        />
      )}
    </span>
  );
}


// Preserve the existing authenticated user avatar interface.
export function UserAvatar({
  size = 44,
  className = "",
}) {
  const { user } = useAuth();

  return (
    <ProfileAvatar
      imageUrl={user?.profileImageUrl}
      size={size}
      className={className}
    />
  );
}
