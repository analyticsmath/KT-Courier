import { afterEach, expect, it, vi } from "vitest";
import { utcDateInputToIso } from "@/lib/utils/utc-date-input";

afterEach(() => vi.unstubAllEnvs());

it.each(["UTC", "Asia/Karachi", "Africa/Johannesburg", "America/New_York"])(
  "preserves an authorized UTC deadline on a device in %s", timezone => {
    vi.stubEnv("TZ", timezone);
    expect(utcDateInputToIso("2026-10-23T16:30")).toBe("2026-10-23T16:30:00.000Z");
  },
);

it.each(["", "2026-10-23T16:30+05:00", "2026-10-23T16:30Z", "not-a-date"])(
  "rejects malformed or already offset input %s", value => {
    expect(() => utcDateInputToIso(value)).toThrow();
  },
);
