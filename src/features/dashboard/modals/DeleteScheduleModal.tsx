type Props = {
  target: any;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteScheduleModal({ target, loading, onClose, onConfirm }: Props) {
  if (!target) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
      <div className="card w-full max-w-md p-4">
        <h3 className="text-lg font-bold">تأیید حذف برنامه</h3>
        <p className="mt-2 text-sm text-slate-300">با حذف برنامه، تمام رزروها و بازه‌های این برنامه هم حذف می‌شوند. ادامه می‌دهید؟</p>
        <p className="mt-2 text-xs text-slate-400">عنوان برنامه: {target.title || "-"}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>انصراف</button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={loading}>{loading ? "در حال حذف..." : "بله، حذف کن"}</button>
        </div>
      </div>
    </div>
  );
}
