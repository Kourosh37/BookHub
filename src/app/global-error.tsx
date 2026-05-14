"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen grid place-items-center p-6">
        <div className="card max-w-md p-6 text-center space-y-3">
          <h1 className="text-xl font-bold">خطای غیرمنتظره</h1>
          <p className="text-sm text-slate-400">مشکل ثبت شد. لطفا دوباره تلاش کنید.</p>
          <button className="btn-primary" onClick={reset}>
            تلاش مجدد
          </button>
        </div>
      </body>
    </html>
  );
}

