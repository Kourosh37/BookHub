import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/700.css";
import { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/shared/providers/toast-provider";
import { ServiceWorkerCleanup } from "@/shared/providers/sw-cleanup";
import { AppQueryProvider } from "@/shared/providers/query-provider";
import { ThemeSync } from "@/shared/providers/theme-sync";

export const metadata = {
  title: "بوک هاب",
  description: "سامانه فارسی رزرو زمان",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/logo-light.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: "/logo-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
    ],
    shortcut: "/favicon.svg",
    apple: "/logo-light.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen">
        <AppQueryProvider>
          <ThemeSync />
          <ServiceWorkerCleanup />
          {children}
          <ToastProvider />
        </AppQueryProvider>
      </body>
    </html>
  );
}

