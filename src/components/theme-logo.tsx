"use client";

import Image from "next/image";
import { useUIStore } from "@/store/ui-store";

type ThemeLogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export function ThemeLogo({ size = 96, className, priority = false }: ThemeLogoProps) {
  const theme = useUIStore((s) => s.theme);
  const src = theme === "light" ? "/logo-light.svg" : "/logo-dark.svg";

  return (
    <Image
      src={src}
      alt="لوگوی بوک هاب"
      width={size}
      height={size}
      className={className}
      priority={priority}
    />
  );
}
