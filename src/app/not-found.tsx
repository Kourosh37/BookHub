import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl p-8 text-center">
      <div className="card p-8">
        <h1 className="text-2xl font-bold">۴۰۴</h1>
        <p className="mt-3 text-slate-600">صفحه مورد نظر پیدا نشد.</p>
        <div className="mt-6">
          <Link href="/dashboard" className="btn-primary">
            رفتن به داشبورد
          </Link>
        </div>
      </div>
    </main>
  );
}
