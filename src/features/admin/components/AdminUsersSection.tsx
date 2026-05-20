import { Phone, Search } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import type { UsersResponse } from "@/features/admin/types/admin";

type Props = {
  users: UsersResponse | null;
  usersQuery: string;
  setUsersQuery: (v: string) => void;
  setUsersPage: (updater: (p: number) => number) => void;
  usersPage: number;
  usersTotalPages: number;
  usersLoading: boolean;
  usersError: string;
  onAvatarClick: (avatarUrl: string | null, displayName: string) => void;
};

export function AdminUsersSection(props: Props) {
  const {
    users,
    usersQuery,
    setUsersQuery,
    setUsersPage,
    usersPage,
    usersTotalPages,
    usersLoading,
    usersError,
    onAvatarClick,
  } = props;

  return (
    <section className="card space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-base font-semibold">لیست کاربران</div>
        <div className="ms-auto flex w-full max-w-md items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-sm text-slate-300">
          <Search size={16} />
          <input
            className="w-full bg-transparent outline-none"
            placeholder="جستجو با شماره موبایل یا نام کاربری"
            value={usersQuery}
            onChange={(e) => {
              setUsersQuery(e.target.value);
              setUsersPage(() => 1);
            }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {usersError && <div className="text-sm text-rose-300">{usersError}</div>}
        {usersLoading && <div className="text-sm text-slate-400">در حال دریافت کاربران...</div>}

        {users?.items?.length ? (
          users.items.map((user) => (
            <div key={user.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2">
              <UserAvatar
                src={user.avatarUrl}
                alt="avatar"
                sizeClassName="h-9 w-9"
                iconSize={16}
                onClick={() => onAvatarClick(user.avatarUrl, user.username || user.phone || "کاربر")}
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm break-words">{user.username || "کاربر"}</div>
                <div className="text-xs text-slate-400">عضویت: {new Date(user.createdAt).toLocaleDateString("fa-IR")}</div>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Phone size={14} />
                <span dir="ltr">{user.phone || "-"}</span>
              </div>
            </div>
          ))
        ) : (
          !usersLoading && <div className="text-sm text-slate-400">کاربری پیدا نشد.</div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-700/50 pt-3 text-sm">
        <span className="text-slate-400">صفحه {users?.page || usersPage} از {usersTotalPages} · مجموع {users?.total ?? 0} کاربر</span>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-ghost" disabled={(users?.page || usersPage) <= 1 || usersLoading} onClick={() => setUsersPage((p) => Math.max(1, p - 1))}>قبلی</button>
          <button type="button" className="btn-ghost" disabled={(users?.page || usersPage) >= usersTotalPages || usersLoading} onClick={() => setUsersPage((p) => Math.min(usersTotalPages, p + 1))}>بعدی</button>
        </div>
      </div>
    </section>
  );
}
