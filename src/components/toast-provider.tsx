"use client";

import { Toaster } from "react-hot-toast";

export function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        style: {
          background: "var(--card-bg)",
          color: "var(--text)",
          border: "1px solid var(--card-border)",
        },
      }}
    />
  );
}
