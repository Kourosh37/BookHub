import { Dialog } from "@/shared/ui/dialog";
type Props = {
  open: boolean;
  deleteCode: string;
  requestingDeleteOtp: boolean;
  deleteOtpCooldown: number;
  deletingAccount: boolean;
  onClose: () => void;
  onCodeChange: (v: string) => void;
  onRequestOtp: () => Promise<void>;
  onConfirmDelete: () => Promise<void>;
};

export function DeleteAccountModal(props: Props) {
  const {
    open,
    deleteCode,
    requestingDeleteOtp,
    deleteOtpCooldown,
    deletingAccount,
    onClose,
    onCodeChange,
    onRequestOtp,
    onConfirmDelete,
  } = props;

  if (!open) return null;

  return (
    <Dialog title="حذف حساب کاربری" onClose={onClose} busy={deletingAccount}>
      <h3 className="text-lg font-bold">حذف حساب کاربری</h3>
      <p className="mt-2 text-sm text-slate-300">
        این عملیات قابل بازگشت نیست. ادامه می‌دهید؟
      </p>
      <div className="mt-4 space-y-3">
        <button
          type="button"
          className="btn-ghost w-full justify-between"
          onClick={onRequestOtp}
          disabled={requestingDeleteOtp || deleteOtpCooldown > 0}
        >
          {requestingDeleteOtp
            ? "در حال ارسال..."
            : deleteOtpCooldown > 0
              ? `ارسال مجدد تا ${deleteOtpCooldown} ثانیه`
              : "ارسال کد تایید حذف"}
        </button>
        <input
          className="input"
          type="tel"
          inputMode="numeric"
          pattern="[0-9۰-۹٠-٩]*"
          autoComplete="one-time-code"
          aria-label="کد تایید ۶ رقمی"
          placeholder="کد تایید ۶ رقمی"
          value={deleteCode}
          onChange={(e) => onCodeChange(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-ghost"
            disabled={deletingAccount}
            onClick={onClose}
          >
            انصراف
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={onConfirmDelete}
            disabled={deletingAccount}
          >
            {deletingAccount ? "در حال حذف..." : "تایید حذف"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
