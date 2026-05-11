export type Question = {
  label: string;
  type: "text" | "textarea";
  required: boolean;
};

export type TimeRange = {
  startTime: string;
  endTime: string;
};

export type DayConfig = {
  date: string;
  ranges: TimeRange[];
};
