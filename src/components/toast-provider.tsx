"use client";

import { Toaster } from "react-hot-toast";

export function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        style: {
          background: "rgb(57, 62, 70)",
          color: "rgb(223, 208, 184)",
          border: "1px solid rgb(148, 137, 121)",
        },
      }}
    />
  );
}
