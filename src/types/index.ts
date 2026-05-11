export type Question = {
  label: string;
  type: "text" | "textarea";
  required: boolean;
};

export type DayConfig = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};
