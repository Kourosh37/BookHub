"use client";

import { useEffect } from "react";
import { useUIStore } from "@/store/ui-store";

export function ThemeSync() {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return null;
}

