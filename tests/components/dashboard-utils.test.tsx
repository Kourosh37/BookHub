// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import * as u from "@/features/dashboard/utils/dashboard-utils";
import { dashboardDefaultListFilters } from "@/features/dashboard/store/dashboard-page-store";
import { useUIStore } from "@/shared/store/ui-store";
afterEach(cleanup);
it("normalizes Persian search/phone values and roundtrips Persian calendar dates", () => {
  expect(u.toEnglishDigits("۱۲٣")).toBe("123");
  expect(u.toPersianDigits("123")).toBe("۱۲۳");
  expect(u.formatPhoneForExport(null)).toBe("-");
  expect(u.formatPhoneForExport("0912")).toBe("۰۹۱۲");
  expect(u.toYmd(null)).toBe("");
  expect(u.toYmd(u.ymdToPersianDateObject("2027-01-01"))).toBe("2027-01-01");
  expect(u.toJalaliLabel("2027-01-01")).toContain("۱۴۰۵");
  expect(u.toJalaliLabel("")).toBe("");
  expect(u.normalizeSearchText(" A۱۲ ")).toBe("a12");
});
it("highlights literal search text without treating it as a regular expression or HTML", () => {
  const { container } = render(
    <>{u.highlightText("<script> a.b a.b", "a.b")}</>,
  );
  expect(container.querySelectorAll("mark")).toHaveLength(2);
  expect(container.querySelector("script")).toBeNull();
  expect(u.highlightText("text", "")).toBe("text");
  expect(u.highlightText("text", "missing")).toBe("text");
});
it("renders answered, unanswered, missing-question and empty states", () => {
  const { rerender } = render(
    <>
      {u.renderAnswers(
        ["Answer"],
        [{ label: "Question" }],
        "",
        u.highlightText,
      )}
    </>,
  );
  expect(screen.getByText("Answer")).toBeVisible();
  rerender(<>{u.renderAnswers([""], [{}], "", u.highlightText)}</>);
  expect(screen.getByText("-")).toBeVisible();
  rerender(<>{u.renderAnswers(["Value"], null, "", u.highlightText)}</>);
  expect(screen.getByText("Value")).toBeVisible();
  rerender(<>{u.renderAnswers(null, [{}], "", u.highlightText)}</>);
  expect(screen.getByText("-")).toBeVisible();
  rerender(<>{u.renderAnswers(null, null, "", u.highlightText)}</>);
  expect(screen.getByText("پاسخی ثبت نشده است.")).toBeVisible();
});
it("counts slots and diagnoses invalid/overlapping time ranges", () => {
  const a = { startTime: "10:00", endTime: "11:00" },
    b = { startTime: "10:30", endTime: "11:30" },
    c = { startTime: "11:00", endTime: "12:00" },
    bad = { startTime: "12:00", endTime: "11:00" };
  expect(u.getRangeLengthMinutes(a)).toBe(60);
  expect(u.estimateSlotCount(a, 30, 10)).toBe(1);
  expect(u.estimateSlotCount(a, 30, 0)).toBe(2);
  expect(u.estimateSlotCount(a, 90, 0)).toBe(0);
  expect(u.estimateSlotCount(a, 0, 0)).toBe(0);
  expect(u.rangesOverlap([a, c])).toBe(false);
  expect(u.rangesOverlap([a, b])).toBe(true);
  expect(u.rangesOverlap([bad])).toBe(true);
  expect(u.getRangeIssues([a, b]).every(Boolean)).toBe(true);
  expect(u.getRangeIssues([bad])[0]).toBeTruthy();
  expect(u.getRangeIssues([a, c])).toEqual([null, null]);
});
it("normalizes legacy avatar URLs without changing unrelated URLs", () => {
  expect(u.normalizePreviewUrl(null)).toBe("");
  expect(u.normalizePreviewUrl("/uploads/a")).toBe("/uploads/a");
  expect(
    u.normalizePreviewUrl("https://old.test/api/profile/avatar/file/a.jpg?v=1"),
  ).toBe("/api/profile/avatar/file/a.jpg?v=1");
  expect(u.normalizePreviewUrl("https://images.test/a.jpg")).toBe(
    "https://images.test/a.jpg",
  );
  expect(u.normalizePreviewUrl("broken")).toBe("broken");
});
it("filters upcoming, past and canceled histories with Tehran date boundaries", () => {
  vi.spyOn(Date, "now").mockReturnValue(
    new Date("2027-01-01T00:00Z").getTime(),
  );
  const list = [
    {
      id: "future",
      scheduleId: "s",
      timeSlot: {
        startTime: "2027-01-02T00:00Z",
        endTime: "2027-01-02T01:00Z",
      },
      status: "CONFIRMED",
    },
    {
      id: "past",
      scheduleId: "s",
      timeSlot: {
        startTime: "2026-12-30T00:00Z",
        endTime: "2026-12-30T01:00Z",
      },
      status: "CONFIRMED",
    },
    {
      id: "canceled",
      scheduleId: "s",
      timeSlot: {
        startTime: "2027-01-02T00:00Z",
        endTime: "2027-01-02T01:00Z",
      },
      status: "CANCELED",
    },
  ];
  const filter = (patch: Partial<typeof dashboardDefaultListFilters>) =>
    u
      .applyListFilters(
        list,
        { ...dashboardDefaultListFilters, ...patch },
        (x, q) => x.id.includes(q),
      )
      .map((x) => x.id);
  expect(filter({})).toEqual(["future"]);
  expect(filter({ period: "past" })).toEqual(["past"]);
  expect(filter({ period: "canceled" })).toEqual(["canceled"]);
  expect(filter({ period: "all" })).toHaveLength(3);
  expect(filter({ period: "all", scheduleIds: ["missing"] })).toEqual([]);
  expect(
    filter({
      period: "all",
      from: "2027-01-02",
      to: "2027-01-02",
      query: "future",
    }),
  ).toEqual(["future"]);
  expect(filter({ period: "all", from: "2027-01-03" })).toEqual([]);
  expect(filter({ period: "all", to: "2026-12-29" })).toEqual([]);
  expect(filter({ query: "missing" })).toEqual([]);
  expect(filter({ from: "invalid", to: "invalid" })).toEqual(["future"]);
});
it("persists theme/tab choices and refreshes avatars", () => {
  const store = useUIStore.getState();
  store.setTheme("light");
  store.toggleTheme();
  expect(useUIStore.getState().theme).toBe("dark");
  store.setDashboardTab("sessions");
  expect(useUIStore.getState().dashboardTab).toBe("sessions");
  const before = useUIStore.getState().avatarRefreshToken;
  store.bumpAvatarRefreshToken();
  expect(useUIStore.getState().avatarRefreshToken).toBe(before + 1);
  expect(localStorage.getItem("bookhub-ui")).toContain("sessions");
});
