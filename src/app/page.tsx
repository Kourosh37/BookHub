import Image from "next/image";
import Link from "next/link";
import { PublicHeader } from "@/components/public-header";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <PublicHeader />
      <div className="grid gap-5 md:grid-cols-3">
        <div className="card p-8 text-center md:col-span-2">
          <Image
            src="/logo.png"
            alt="لوگوی بوک هاب"
            width={120}
            height={120}
            className="mx-auto mb-4 h-24 w-24 rounded-2xl object-cover"
            priority
          />
          <h1 className="text-3xl font-bold">بوک هاب</h1>
          <p className="mt-3 text-slate-500">سامانه رزرو زمان با تقویم جلالی</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/login" className="btn-primary">ورود</Link>
            <Link href="/register" className="btn-ghost">ثبت‌نام</Link>
          </div>
        </div>
        <aside className="card space-y-3 p-5">
          <h2 className="text-lg font-bold">ویژگی‌ها</h2>
          <p className="text-sm text-slate-400">ساخت برنامه‌های زمانی، لینک اشتراکی، رزرو مهمان و مدیریت جلسات در یک داشبورد واحد.</p>
          <div className="rounded-xl border border-cyan-700/60 bg-cyan-500/10 p-3 text-sm text-cyan-200">
            سوییچ تم فعال است. ظاهر دلخواهت را بین لایت و دارک انتخاب کن.
          </div>
        </aside>
      </div>
    </main>
  );
}
