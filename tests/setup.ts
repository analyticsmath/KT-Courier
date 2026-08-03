import { afterEach, vi } from "vitest";

process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
