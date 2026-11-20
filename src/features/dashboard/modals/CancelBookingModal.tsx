import { Dialog } from "@/shared/ui/dialog";
import { formatJalaliDateTime } from "@/lib/date-time";

type Props = {
  cancelTarget: any;
  cancelLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function CancelBookingModal({
  cancelTarget,
  cancelLoading,
  onClose,
  onConfirm,
}: Props) {
  if (!cancelTarget) return null;

  return (
    <Dialog title="تأیید کنسل رزرو" onClose={onClose} busy={cancelLoading}>
      <h3 className="text-lg font-bold">تأیید کنسل رزرو</h3>
      <p className="mt-2 text-sm text-slate-300">
        مطمئن هستید که می‌خواهید این رزرو را کنسل کنید؟
      </p>
      <p className="mt-2 text-xs text-slate-400">
        برنامه: {cancelTarget.schedule?.title || "-"}
      </p>
      <p className="text-xs text-slate-400">
        زمان:{" "}
        {cancelTarget.timeSlot?.startTime
          ? formatJalaliDateTime(new Date(cancelTarget.timeSlot.startTime))
          : "-"}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          className="btn-ghost"
          onClick={onClose}
          disabled={cancelLoading}
        >
          انصراف
        </button>
        <button
          type="button"
          className="btn-danger"
          onClick={onConfirm}
          disabled={cancelLoading}
        >
          {cancelLoading ? "در حال کنسل..." : "بله، کنسل کن"}
        </button>
      </div>
    </Dialog>
  );
}
