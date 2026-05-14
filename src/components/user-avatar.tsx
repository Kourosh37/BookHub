"use client";

import { useMemo, useState } from "react";
import { User } from "lucide-react";

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
  const normalizedSrc = useMemo(() => normalizeAvatarSrc(src), [src]);
  const clickableClass = onClick ? "cursor-pointer" : "";

  if (!normalizedSrc || errored) {
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
    <img
      src={normalizedSrc}
      alt={alt}
      className={`${sizeClassName} ${clickableClass} rounded-full border border-slate-700 object-cover ${className}`.trim()}
      onClick={onClick}
      onError={() => setErrored(true)}
    />
  );
}

