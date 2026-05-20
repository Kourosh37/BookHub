import { formatJalaliDateTime } from "@/lib/date-time";

type Props = {
  cancelTarget: any;
  cancelLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function CancelBookingModal({ cancelTarget, cancelLoading, onClose, onConfirm }: Props) {
  if (!cancelTarget) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
      <div className="card w-full max-w-md p-4">
        <h3 className="text-lg font-bold">تأیید کنسل رزرو</h3>
        <p className="mt-2 text-sm text-slate-300">مطمئن هستید که می‌خواهید این رزرو را کنسل کنید؟</p>
        <p className="mt-2 text-xs text-slate-400">برنامه: {cancelTarget.schedule?.title || "-"}</p>
        <p className="text-xs text-slate-400">زمان: {cancelTarget.timeSlot?.startTime ? formatJalaliDateTime(new Date(cancelTarget.timeSlot.startTime)) : "-"}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={cancelLoading}>انصراف</button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={cancelLoading}>{cancelLoading ? "در حال کنسل..." : "بله، کنسل کن"}</button>
        </div>
      </div>
    </div>
  );
}
