import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="card p-8 text-center">
        <Image
          src="/logo.png"
          alt="لوگوی بوک هاب"
          width={120}
          height={120}
          className="mx-auto mb-4 h-24 w-24 rounded-2xl object-cover"
          priority
        />
        <h1 className="text-3xl font-bold">بوک هاب</h1>
        <p className="mt-3 text-slate-600">سامانه رزرو زمان با تقویم جلالی</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/login" className="btn-primary">ورود</Link>
          <Link href="/register" className="btn border border-slate-300">ثبت‌نام</Link>
        </div>
      </div>
    </main>
  );
}
