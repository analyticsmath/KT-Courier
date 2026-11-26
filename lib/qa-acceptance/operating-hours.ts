import { z } from "zod";

export const STORE_WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type StoreWeekday = (typeof STORE_WEEKDAYS)[number];

const HH_MM_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const StoreDayScheduleSchema = z
  .object({
    closed: z.boolean(),
    open: z.string().regex(HH_MM_REGEX, "Open time must use HH:MM (24-hour)").optional(),
    close: z.string().regex(HH_MM_REGEX, "Close time must use HH:MM (24-hour)").optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.closed) {
      if (!val.open || !val.close) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Open and close times are required on open days.",
        });
        return;
      }
      if (val.open >= val.close) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Closing time must be later than opening time.",
        });
      }
    }
  });

export const StoreOperatingHoursSchema = z.object({
  timezone: z.string().trim().min(1).max(64).default("Africa/Johannesburg"),
  collectionWindowNote: z.string().trim().max(240).optional(),
  days: z.object({
    monday: StoreDayScheduleSchema,
    tuesday: StoreDayScheduleSchema,
    wednesday: StoreDayScheduleSchema,
    thursday: StoreDayScheduleSchema,
    friday: StoreDayScheduleSchema,
    saturday: StoreDayScheduleSchema,
    sunday: StoreDayScheduleSchema,
  }),
});

export type StoreDaySchedule = z.infer<typeof StoreDayScheduleSchema>;
export type StoreOperatingHours = z.infer<typeof StoreOperatingHoursSchema>;

export const DEFAULT_STORE_OPERATING_HOURS: StoreOperatingHours = {
  timezone: "Africa/Johannesburg",
  collectionWindowNote: "Courier collection Monday to Friday, 09:00 to 16:30 SAST.",
  days: {
    monday: { closed: false, open: "08:00", close: "17:00" },
    tuesday: { closed: false, open: "08:00", close: "17:00" },
    wednesday: { closed: false, open: "08:00", close: "17:00" },
    thursday: { closed: false, open: "08:00", close: "17:00" },
    friday: { closed: false, open: "08:00", close: "17:00" },
    saturday: { closed: false, open: "09:00", close: "13:00" },
    sunday: { closed: true },
  },
};

export function parseStoreOperatingHours(raw: unknown): StoreOperatingHours | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = StoreOperatingHoursSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export type StoreScheduleDisplay = Readonly<{
  configured: boolean;
  statusLabel: "TRADING_HOURS_CONFIGURED" | "HOURS_UNAVAILABLE";
  summary: string | null;
  hours: StoreOperatingHours | null;
}>;

const DAY_LABELS: Record<StoreWeekday, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

export function formatStoreOperatingHoursSummary(raw: unknown): StoreScheduleDisplay {
  const hours = parseStoreOperatingHours(raw);
  if (!hours) {
    return Object.freeze({
      configured: false,
      statusLabel: "HOURS_UNAVAILABLE",
      summary: null,
      hours: null,
    });
  }

  const parts = STORE_WEEKDAYS.map((day) => {
    const slot = hours.days[day];
    if (slot.closed) return `${DAY_LABELS[day]}: Closed`;
    return `${DAY_LABELS[day]}: ${slot.open ?? "08:00"}-${slot.close ?? "17:00"}`;
  });

  const collectionNote = hours.collectionWindowNote ? ` | ${hours.collectionWindowNote}` : "";

  return Object.freeze({
    configured: true,
    statusLabel: "TRADING_HOURS_CONFIGURED",
    summary: `${parts.join(", ")} (${hours.timezone})${collectionNote}`,
    hours,
  });
}
