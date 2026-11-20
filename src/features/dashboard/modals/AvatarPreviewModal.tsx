import { Dialog } from "@/shared/ui/dialog";
import Image from "next/image";

type Props = {
  avatarPreview: { url: string; name: string } | null;
  onClose: () => void;
};

export function AvatarPreviewModal({ avatarPreview, onClose }: Props) {
  if (!avatarPreview) return null;

  return (
    <Dialog title="پیش‌نمایش تصویر" onClose={onClose} busy={false}>
      <h3 className="mb-3 text-lg font-bold">{avatarPreview.name}</h3>
      <Image
        src={avatarPreview.url}
        alt={avatarPreview.name}
        width={1200}
        height={900}
        className="mx-auto max-h-[70vh] w-auto rounded-2xl object-contain"
        unoptimized
      />
      <div className="mt-4 flex justify-end">
        <button type="button" className="btn-ghost" onClick={onClose}>
          بستن
        </button>
      </div>
    </Dialog>
  );
}
