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
  initials = "",
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
      ) : initials ? (
        <span
          className="font-extrabold"
          style={{ fontSize: size * 0.36 }}
        >
          {initials}
        </span>
      ) : (
        <Icon
          name="user"
          className="h-[55%] w-[55%]"
        />
      )}
    </span>
  );
}


// Private avatar for the authenticated student.
function PrivateStudentAvatar({
  size,
  className,
  initials,
  revision,
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#edf1fa] text-[#26469b] ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {initials ? (
        <span
          className="font-extrabold"
          style={{ fontSize: size * 0.36 }}
        >
          {initials}
        </span>
      ) : (
        <Icon
          name="user"
          className="h-[55%] w-[55%]"
        />
      )}

      {!failed && (
        <Image
          src={`/api/profile/student/image?v=${revision}`}
          alt=""
          width={size}
          height={size}
          unoptimized
          className="absolute inset-0 h-full w-full object-cover object-[center_20%]"
          onError={() => setFailed(true)}
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

  const initials =
    typeof user?.fullName === "string"
      ? user.fullName
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => Array.from(part)[0])
          .join("")
          .toUpperCase()
      : "";

  if (
    user?.role === "student" &&
    user.hasProfileImage === true
  ) {
    return (
      <PrivateStudentAvatar
        key={`${user.id}:${user.avatarRevision ?? 0}`}
        revision={user.avatarRevision ?? 0}
        initials={initials}
        size={size}
        className={className}
      />
    );
  }

  return (
    <ProfileAvatar
      key={`${user?.id ?? "guest"}:${user?.profileImageUrl ?? ""}`}
      imageUrl={
        user?.role === "tutor"
          ? user.profileImageUrl
          : null
      }
      initials={initials}
      size={size}
      className={className}
    />
  );
}
