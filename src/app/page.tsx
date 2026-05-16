import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock3, Link2, ShieldCheck } from "lucide-react";
import { PublicHeader } from "@/components/public-header";

export default function Home() {
  return (
    <main className="page-shell py-6">
      <PublicHeader compact />
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card p-7 sm:p-8 lg:col-span-2">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <Image
              src="/logo.svg"
              alt="لوگوی بوک هاب"
              width={120}
              height={120}
              className="h-20 w-20 shrink-0 rounded-2xl object-contain sm:h-24 sm:w-24"
              priority
            />
            <div className="space-y-3">
              <h1 className="text-3xl font-extrabold sm:text-4xl">بوک هاب</h1>
              <p className="text-base text-slate-400 sm:text-lg">
                مدیریت رزرو جلسه برای تیم‌ها، مشاوران و مدرس‌ها با لینک اشتراکی، زمان‌بندی دقیق و ثبت خودکار نوبت‌ها.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-500/10 p-4">
              <p className="text-sm font-semibold">ساخت برنامه زمانی</p>
              <p className="mt-1 text-sm text-slate-400">برای هر روز بازه تعریف کن، مدت جلسه تعیین کن و لینک رزرو تحویل بده.</p>
            </div>
            <div className="rounded-xl bg-slate-500/10 p-4">
              <p className="text-sm font-semibold">کنترل رزروها</p>
              <p className="mt-1 text-sm text-slate-400">رزروهای ثبت‌شده، پاسخ فرم‌ها و وضعیت جلسات را یکجا مدیریت کن.</p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary">شروع رایگان</Link>
            <Link href="/login" className="btn-ghost">ورود به حساب</Link>
          </div>
        </section>

        <aside className="card space-y-4 p-5">
          <h2 className="text-lg font-bold">چرا بوک هاب</h2>

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2 rounded-xl bg-slate-500/10 p-3">
              <CalendarDays size={16} className="mt-0.5 shrink-0" />
              <p>تقویم کاری منظم با جلوگیری از همپوشانی بازه‌ها.</p>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-slate-500/10 p-3">
              <Clock3 size={16} className="mt-0.5 shrink-0" />
              <p>تخصیص خودکار اسلات‌ها بر اساس مدت جلسه و فاصله بین نوبت‌ها.</p>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-slate-500/10 p-3">
              <Link2 size={16} className="mt-0.5 shrink-0" />
              <p>لینک رزرو اختصاصی برای اشتراک سریع با مراجع یا مشتری.</p>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-slate-500/10 p-3">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" />
              <p>ورود امن با OTP یا رمز عبور و مدیریت حساب کاربری.</p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
