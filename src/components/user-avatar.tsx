"use client";

import { useEffect, useMemo, useState } from "react";
import { useUIStore } from "@/store/ui-store";
import Image from "next/image";

type Props = {
  src?: string | null;
  alt: string;
  sizeClassName?: string;
  iconSize?: number;
  className?: string;
  onClick?: () => void;
};

function normalizeAvatarSrc(src?: string | null) {
  if (!src) return "";
  const trimmed = src.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.pathname.startsWith("/uploads/") || url.pathname.startsWith("/api/profile/avatar")) {
      return `${url.pathname}${url.search}`;
    }
    return trimmed;
  } catch {
    return trimmed.startsWith("uploads/") ? `/${trimmed}` : trimmed;
  }
}

export function UserAvatar({
  src,
  alt,
  sizeClassName = "h-10 w-10",
  iconSize = 16,
  className = "",
  onClick,
}: Props) {
  const [errored, setErrored] = useState(false);
  const avatarRefreshToken = useUIStore((s) => s.avatarRefreshToken);
  const theme = useUIStore((s) => s.theme);
  const normalizedSrc = useMemo(() => normalizeAvatarSrc(src), [src]);
  const fallbackSrc = theme === "light" ? "/default-avatar-light.svg" : "/default-avatar-dark.svg";
  const finalSrc = useMemo(() => {
    if (!normalizedSrc) return "";
    if (normalizedSrc.startsWith("/api/profile/avatar/file/") || normalizedSrc.startsWith("/uploads/avatars/")) {
      const sep = normalizedSrc.includes("?") ? "&" : "?";
      return `${normalizedSrc}${sep}av=${avatarRefreshToken}`;
    }
    return normalizedSrc;
  }, [normalizedSrc, avatarRefreshToken]);
  const clickableClass = onClick ? "cursor-pointer" : "";

  useEffect(() => {
    setErrored(false);
  }, [finalSrc]);

  const displaySrc = !finalSrc || errored ? fallbackSrc : finalSrc;

  return (
    <div
      className={`${sizeClassName} ${clickableClass} relative overflow-hidden rounded-full border border-slate-700 ${className}`.trim()}
      style={{ clipPath: "circle(50% at 50% 50%)" }}
      onClick={onClick}
    >
      <Image
        src={displaySrc}
        alt={alt || "avatar"}
        fill
        sizes="64px"
        className="absolute inset-0 h-full w-full rounded-full object-cover"
        unoptimized={displaySrc !== fallbackSrc}
        onError={() => setErrored(true)}
      />
    </div>
  );
}
