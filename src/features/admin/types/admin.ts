export type AdminStats = {
  totalUsers: number;
  totalSchedules: number;
  totalBookings: number;
  bookingsToday: number;
  bookingsWeek: number;
  bookingsMonth: number;
  sessionsToday: number;
  sessionsWeek: number;
  sessionsMonth: number;
  upcomingSessions: number;
};

export type SmsCounts = Record<string, number>;

export type SmsSettings = {
  bookingCreatedEnabled: boolean;
  bookingCanceledEnabled: boolean;
  bookingReminderEnabled: boolean;
};

export type AdminUser = {
  id: string;
  phone: string | null;
  username: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

export type UsersResponse = {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
};
