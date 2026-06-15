import { LogOut, Moon, Sun } from "lucide-react";
import { UserAvatar } from "@/shared/ui/user-avatar";

type Props = {
  user: any;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onLogout: () => void;
  onOpenAvatar: () => void;
};

export function DashboardHeader({ user, theme, onToggleTheme, onLogout, onOpenAvatar }: Props) {
  return (
    <div className="card mb-8 p-4 md:mb-10 md:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <UserAvatar
          src={user?.avatarUrl}
          alt="avatar"
          sizeClassName="h-10 w-10"
          iconSize={16}
          onClick={onOpenAvatar}
        />
        <div className="min-w-0">
          <h1 className="text-xl font-bold md:text-2xl">داشبورد رزرو</h1>
          <p className="mt-1 text-sm text-slate-400">{user ? `${user.username || user.phone} عزیز خوش آمدید` : "مدیریت زمان‌بندی، رزروها و پروفایل"}</p>
        </div>
        <div className="ms-auto ml-2 flex items-center gap-3 sm:ml-3 sm:gap-4">
          <button type="button" className="btn-ghost theme-toggle header-action-btn w-10 p-0" onClick={onToggleTheme} aria-label="تغییر تم">
            {theme === "dark" ? <Sun strokeWidth={2.25} /> : <Moon strokeWidth={2.25} />}
          </button>
          <button onClick={onLogout} className="btn-danger header-action-btn px-3" aria-label="خروج" title="خروج">
            <LogOut size={18} className="icon-danger" />
            <span className="hidden md:inline">خروج</span>
          </button>
        </div>
      </div>
    </div>
  );
}

