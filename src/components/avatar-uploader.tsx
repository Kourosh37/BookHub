"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

type Props = {
  currentAvatarUrl?: string | null;
  onUploaded: (avatarUrl: string) => void;
};

const CROP_SIZE = 320;

export function AvatarUploader({ currentAvatarUrl, onUploaded }: Props) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const baseScale = useMemo(() => {
    if (!natural.w || !natural.h) return 1;
    return Math.max(CROP_SIZE / natural.w, CROP_SIZE / natural.h);
  }, [natural]);

  function openCrop(file: File) {
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("فرمت فایل معتبر نیست");
    openCrop(file);
    e.target.value = "";
  }

  async function buildCroppedBlob() {
    if (!imgRef.current || !sourceUrl) throw new Error("IMAGE_NOT_READY");
    const img = imgRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("CANVAS_CONTEXT_FAILED");

    const renderW = natural.w * baseScale * zoom;
    const renderH = natural.h * baseScale * zoom;
    const drawX = CROP_SIZE / 2 - renderW / 2 + offsetX;
    const drawY = CROP_SIZE / 2 - renderH / 2 + offsetY;
    const factor = 512 / CROP_SIZE;

    ctx.drawImage(img, drawX * factor, drawY * factor, renderW * factor, renderH * factor);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("BLOB_FAILED"));
        resolve(blob);
      }, "image/jpeg", 0.9);
    });
  }

  async function uploadCropped() {
    try {
      setUploading(true);
      setProgress(0);
      const blob = await buildCroppedBlob();
      const fd = new FormData();
      fd.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));

      const result = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/profile/avatar");
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          setProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
        };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText || "{}");
            if (xhr.status >= 200 && xhr.status < 300) resolve(data);
            else reject(new Error(data?.details || data?.error || "UPLOAD_FAILED"));
          } catch {
            reject(new Error("UPLOAD_FAILED"));
          }
        };
        xhr.onerror = () => reject(new Error("NETWORK_ERROR"));
        xhr.send(fd);
      });

      setProgress(100);
      if (result?.avatarUrl) {
        onUploaded(result.avatarUrl);
        toast.success("عکس پروفایل ذخیره شد");
      }
      setTimeout(() => {
        setSourceUrl(null);
        setUploading(false);
        setProgress(0);
      }, 350);
    } catch (e: any) {
      setUploading(false);
      toast.error(e?.message || "خطا در آپلود عکس");
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm text-slate-300">عکس پروفایل</label>
      <div className="flex items-center gap-3">
        {currentAvatarUrl ? (
          <img src={currentAvatarUrl} alt="avatar preview" className="h-12 w-12 rounded-full border border-slate-700 object-cover" />
        ) : (
          <div className="h-12 w-12 rounded-full border border-slate-700" />
        )}
        <label className="btn-ghost cursor-pointer">
          انتخاب عکس
          <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
        </label>
      </div>

      {sourceUrl && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/80 p-4">
          <div className="card w-full max-w-xl p-4">
            <h3 className="text-lg font-bold">برش عکس پروفایل</h3>
            <p className="mt-1 text-xs text-slate-400">محدوده مربعی انتخاب می‌شود و خروجی دایره‌ای نمایش داده خواهد شد.</p>
            <div className="mt-3 grid place-items-center">
              <div className="relative overflow-hidden rounded-2xl border border-slate-700" style={{ width: CROP_SIZE, height: CROP_SIZE }}>
                <img
                  ref={imgRef}
                  src={sourceUrl}
                  alt="crop source"
                  className="absolute max-w-none"
                  onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                  style={{
                    width: natural.w ? natural.w * baseScale * zoom : "100%",
                    height: natural.h ? natural.h * baseScale * zoom : "100%",
                    left: CROP_SIZE / 2 - (natural.w * baseScale * zoom) / 2 + offsetX,
                    top: CROP_SIZE / 2 - (natural.h * baseScale * zoom) / 2 + offsetY,
                  }}
                />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <label className="block text-xs text-slate-400">بزرگنمایی</label>
              <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
              <label className="block text-xs text-slate-400">جابجایی افقی</label>
              <input type="range" min="-180" max="180" step="1" value={offsetX} onChange={(e) => setOffsetX(Number(e.target.value))} className="w-full" />
              <label className="block text-xs text-slate-400">جابجایی عمودی</label>
              <input type="range" min="-180" max="180" step="1" value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value))} className="w-full" />
            </div>
            {uploading && (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-slate-400">
                  <span>در حال آپلود...</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full bg-cyan-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost" disabled={uploading} onClick={() => setSourceUrl(null)}>انصراف</button>
              <button type="button" className="btn-primary" disabled={uploading} onClick={uploadCropped}>
                {uploading ? "در حال آپلود..." : "ذخیره عکس"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
