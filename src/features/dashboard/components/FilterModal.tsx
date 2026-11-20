"use client";
import { ReactNode } from "react";
import { Dialog } from "@/shared/ui/dialog";
export function FilterModal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <Dialog
      title="فیلترهای بیشتر"
      onClose={onClose}
      className="grid gap-4 sm:grid-cols-2"
    >
      {children}
    </Dialog>
  );
}
