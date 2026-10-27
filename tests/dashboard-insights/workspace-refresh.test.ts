// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
import { WorkspaceRefresh } from "@/components/protected-v2/studio/WorkspaceRefresh";
let root: Root;
let container: HTMLDivElement;
beforeEach(async () => {
  vi.useFakeTimers();
  mocks.refresh.mockReset();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      React.createElement(WorkspaceRefresh, {
        checkedAt: "2026-10-27T10:00:00Z",
      }),
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});
describe("Dashboard refresh", () => {
  it("refreshes every minute while visible without an initial duplicate request", async () => {
    expect(mocks.refresh).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(60000));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("12:00:00");
    expect(container.querySelector("time")?.dateTime).toBe(
      "2026-10-27T10:00:00Z",
    );
  });
  it("pauses hidden tabs and refreshes when visible again", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () => vi.advanceTimersByTime(120000));
    expect(mocks.refresh).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
  it("provides manual refresh and removes its timer on unmount", async () => {
    await act(async () => container.querySelector("button")!.click());
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
    await act(async () => vi.advanceTimersByTime(60000));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    root = createRoot(container);
  });
});
