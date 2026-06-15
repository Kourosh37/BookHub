"use client";

import { ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function FilterModal({ open, onClose, children }: Props) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        className={`fixed inset-0 z-50 cursor-default bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300 ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div
        className={`fixed left-1/2 top-1/2 z-[60] grid max-h-[calc(100dvh-48px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-[calc(100vw-32px)] max-w-3xl origin-center -translate-x-1/2 gap-4 overflow-y-auto overscroll-contain rounded-2xl border border-slate-700/50 bg-slate-950/95 p-3 pb-10 shadow-2xl backdrop-blur transition-all duration-300 ease-out sm:grid-cols-2 ${
          open ? "pointer-events-auto -translate-y-1/2 scale-100 opacity-100" : "pointer-events-none -translate-y-[46%] scale-[0.96] opacity-0"
        }`}
        aria-hidden={!open}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
