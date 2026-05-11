import { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/toast-provider";

export const metadata = {
  title: "بوک هاب",
  description: "سامانه فارسی رزرو زمان",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
