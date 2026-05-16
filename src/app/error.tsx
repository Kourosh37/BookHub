"use client";

export default function ErrorPage() {
  return (
    <main className="page-shell py-8 text-center">
      <div className="card mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-bold">خطای سرور</h1>
        <p className="mt-3 text-slate-600">مشکلی رخ داده است. لطفاً دوباره تلاش کنید.</p>
      </div>
    </main>
  );
}
