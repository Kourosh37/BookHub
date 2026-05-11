export type Question = {
  label: string;
  type: "text" | "textarea";
  required: boolean;
};

export type DayConfig = {
  date: string;
  startTime: string;
  endTime: string;
};
