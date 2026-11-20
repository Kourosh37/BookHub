// @vitest-environment jsdom
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { Dialog } from "@/shared/ui/dialog";
import { FilterModal } from "@/features/dashboard/components/FilterModal";
import { PublicHeader } from "@/shared/ui/public-header";
import { ThemeLogo } from "@/shared/ui/theme-logo";
import { UserAvatar } from "@/shared/ui/user-avatar";
import { SettingsSection } from "@/features/dashboard/components/SettingsSection";
import { CancelBookingModal } from "@/features/dashboard/modals/CancelBookingModal";
import { DeleteScheduleModal } from "@/features/dashboard/modals/DeleteScheduleModal";
import { AvatarPreviewModal } from "@/features/dashboard/modals/AvatarPreviewModal";
import { QrShareModal } from "@/features/dashboard/modals/QrShareModal";
import { useUIStore } from "@/shared/store/ui-store";
beforeEach(() => useUIStore.setState(useUIStore.getInitialState(), true));
afterEach(cleanup);
it("traps dialog focus, handles Escape and restores previous focus", async () => {
  const user = userEvent.setup(),
    close = vi.fn();
  const { rerender } = render(<button>Open</button>);
  screen.getByText("Open").focus();
  rerender(
    <>
      <button>Open</button>
      <Dialog title="Test dialog" onClose={close}>
        <button>First</button>
        <button>Last</button>
      </Dialog>
    </>,
  );
  expect(screen.getByRole("dialog")).toHaveFocus();
  await user.tab();
  expect(screen.getByText("First")).toHaveFocus();
  await user.tab({ shift: true });
  expect(screen.getByText("Last")).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(close).toHaveBeenCalledOnce();
  rerender(<button>Open</button>);
  expect(screen.getByText("Open")).toHaveFocus();
});
it("does not close a busy dialog or expose a closed filter to keyboard focus", async () => {
  const user = userEvent.setup(),
    close = vi.fn(),
    { rerender } = render(
      <Dialog title="Busy" onClose={close} busy>
        <button>Save</button>
      </Dialog>,
    );
  await user.keyboard("{Escape}");
  expect(close).not.toHaveBeenCalled();
  rerender(
    <FilterModal open={false} onClose={close}>
      <button>Hidden</button>
    </FilterModal>,
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByText("Hidden")).toBeNull();
});
it("toggles header theme, logo and theme-specific avatar fallback", async () => {
  const user = userEvent.setup();
  render(
    <>
      <PublicHeader />
      <ThemeLogo />
      <UserAvatar alt="Guest" src={null} />
    </>,
  );
  expect(screen.getByAltText("لوگوی بوک هاب").getAttribute("src")).toContain(
    "logo-dark",
  );
  await user.click(screen.getByRole("button", { name: "تغییر تم" }));
  expect(useUIStore.getState().theme).toBe("light");
  expect(screen.getByAltText("لوگوی بوک هاب").getAttribute("src")).toContain(
    "logo-light",
  );
  expect(screen.getByAltText("Guest").getAttribute("src")).toContain(
    "default-avatar-light",
  );
});
it("falls back after an avatar fails and accepts a refreshed source", async () => {
  const { rerender } = render(
    <UserAvatar alt="Person" src="/api/profile/avatar/file/photo.jpg" />,
  );
  fireEvent.error(screen.getByAltText("Person"));
  expect(screen.getByAltText("Person").getAttribute("src")).toContain(
    "default-avatar",
  );
  rerender(
    <UserAvatar
      alt="Person"
      src="https://old.test/api/profile/avatar/file/new.jpg"
    />,
  );
  await waitFor(() =>
    expect(screen.getByAltText("Person").getAttribute("src")).toContain(
      "/api/profile/avatar/file/new.jpg",
    ),
  );
});
it("changes SMS settings with explicit saving and error feedback", async () => {
  const user = userEvent.setup(),
    update = vi.fn(),
    props = {
      settingsSections: { sms: true },
      toggleSettingsSection: vi.fn(),
      smsPreferences: {
        bookingCreated: true,
        bookingCanceled: true,
        bookingReminder: true,
      },
      smsPreferencesSaving: false,
      smsPreferencesError: "",
      updateSmsPreferences: update,
    };
  const { rerender } = render(<SettingsSection {...props} />);
  await user.click(screen.getAllByRole("checkbox")[0]);
  expect(update).toHaveBeenCalledWith({
    ...props.smsPreferences,
    bookingCreated: false,
  });
  rerender(
    <SettingsSection
      {...props}
      smsPreferencesSaving
      smsPreferencesError="Failed"
    />,
  );
  expect(screen.getAllByRole("checkbox")[0]).toBeDisabled();
  expect(screen.getByText("Failed")).toBeVisible();
});
it("prevents duplicate cancellation while a request is pending", async () => {
  const confirm = vi.fn(),
    close = vi.fn(),
    target = {
      schedule: { title: "A" },
      timeSlot: { startTime: "2027-01-01T10:00Z" },
    };
  const { rerender } = render(
    <CancelBookingModal
      cancelTarget={null}
      cancelLoading={false}
      onClose={close}
      onConfirm={confirm}
    />,
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  rerender(
    <CancelBookingModal
      cancelTarget={target}
      cancelLoading
      onClose={close}
      onConfirm={confirm}
    />,
  );
  expect(screen.getByRole("button", { name: "در حال کنسل..." })).toBeDisabled();
  rerender(
    <CancelBookingModal
      cancelTarget={target}
      cancelLoading={false}
      onClose={close}
      onConfirm={confirm}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "بله، کنسل کن" }));
  expect(confirm).toHaveBeenCalledOnce();
});
it("requires explicit confirmation before deleting a schedule", async () => {
  const confirm = vi.fn(),
    close = vi.fn();
  render(
    <DeleteScheduleModal
      target={{ title: "A" }}
      loading={false}
      onClose={close}
      onConfirm={confirm}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "انصراف" }));
  expect(close).toHaveBeenCalledOnce();
  expect(confirm).not.toHaveBeenCalled();
});
it("opens avatar previews and creates downloadable QR links", () => {
  const close = vi.fn(),
    share = vi.fn(),
    { rerender } = render(
      <AvatarPreviewModal
        avatarPreview={{ url: "/logo-dark.svg", name: "Name" }}
        onClose={close}
      />,
    );
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getByAltText("Name")).toBeVisible();
  rerender(
    <QrShareModal
      qrModal={{
        schedule: { title: "Title", shareId: "abc" },
        url: "http://localhost/schedule/abc",
      }}
      qrDataUrl="data:image/png;base64,test"
      onClose={close}
      onShare={share}
    />,
  );
  expect(screen.getByRole("link", { name: "دانلود QR" })).toHaveAttribute(
    "download",
    "bookhub-abc.png",
  );
});
