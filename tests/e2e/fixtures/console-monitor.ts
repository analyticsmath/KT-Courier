import { expect, type Page } from "@playwright/test";

export interface ConsoleMonitor {
  pageErrors: Error[];
  consoleErrors: string[];
  hydrationErrors: string[];
  http500s: string[];
  assertClean: () => void;
}

export function attachConsoleMonitor(page: Page): ConsoleMonitor {
  const pageErrors: Error[] = [];
  const consoleErrors: string[] = [];
  const hydrationErrors: string[] = [];
  const http500s: string[] = [];

  page.on("pageerror", (err) => {
    pageErrors.push(err);
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (text.includes("Hydration") || text.includes("did not match") || text.includes("Text content does not match")) {
        hydrationErrors.push(text);
      } else {
        consoleErrors.push(text);
      }
    }
  });

  page.on("response", (res) => {
    if (res.status() >= 500) {
      http500s.push(`${res.status()} ${res.url()}`);
    }
  });

  return {
    pageErrors,
    consoleErrors,
    hydrationErrors,
    http500s,
    assertClean() {
      expect(pageErrors, "Uncaught page errors").toEqual([]);
      expect(consoleErrors, "Unexpected console errors").toEqual([]);
      expect(hydrationErrors, "React hydration errors").toEqual([]);
      expect(http500s, "Unexpected HTTP 500 responses").toEqual([]);
    },
  };
}
