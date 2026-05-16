import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/700.css";
import { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/toast-provider";
import { ServiceWorkerCleanup } from "@/components/sw-cleanup";
import { AppQueryProvider } from "@/components/query-provider";
import { ThemeSync } from "@/components/theme-sync";

export const metadata = {
  title: "بوک هاب",
  description: "سامانه فارسی رزرو زمان",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/logo.svg", type: "image/svg+xml" },
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
