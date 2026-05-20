import { Download, Share2 } from "lucide-react";

type Props = {
  qrModal: { schedule: any; url: string } | null;
  qrDataUrl: string;
  onClose: () => void;
  onShare: () => void;
};

export function QrShareModal({ qrModal, qrDataUrl, onClose, onShare }: Props) {
  if (!qrModal) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/80 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">اشتراک‌گذاری برنامه</h3>
        <p className="mt-1 text-sm text-slate-400">{qrModal.schedule?.title || "برنامه"}</p>
        <a className="mt-2 block break-all text-xs text-cyan-300" href={qrModal.url} target="_blank" rel="noreferrer">{qrModal.url}</a>
        <div className="mt-4 flex items-center justify-center rounded-2xl bg-white p-3">
          {qrDataUrl ? <img src={qrDataUrl} alt="QR" className="h-48 w-48" /> : <div className="text-xs text-slate-500">در حال ساخت QR...</div>}
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {qrDataUrl && <a className="btn-ghost" href={qrDataUrl} download={`bookhub-${qrModal.schedule?.shareId || "schedule"}.png`}><Download size={16} /> دانلود QR</a>}
          <button type="button" className="btn-primary" onClick={onShare}><Share2 size={16} /> اشتراک‌گذاری</button>
          <button type="button" className="btn-ghost" onClick={onClose}>بستن</button>
        </div>
      </div>
    </div>
  );
}
