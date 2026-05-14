"use client";

import { useEffect, useMemo, useState } from "react";
import { User } from "lucide-react";
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
  const normalizedSrc = useMemo(() => normalizeAvatarSrc(src), [src]);
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

  if (!finalSrc || errored) {
    return (
      <div
        className={`${sizeClassName} ${clickableClass} rounded-full border border-slate-700 grid place-items-center text-slate-400 ${className}`.trim()}
        onClick={onClick}
      >
        <User size={iconSize} />
      </div>
    );
  }

  return (
    <div className={`${sizeClassName} ${clickableClass} relative overflow-hidden rounded-full border border-slate-700 ${className}`.trim()} onClick={onClick}>
      <Image
        src={finalSrc}
        alt={alt}
        fill
        sizes="64px"
        className="object-cover"
        unoptimized
        onError={() => setErrored(true)}
      />
    </div>
  );
}
