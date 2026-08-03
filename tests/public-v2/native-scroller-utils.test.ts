import { describe, expect, it } from "vitest";
import { anonymousTracking } from "@/components/public-v2/site/tracking-copy";
import {
  clampNativeScrollerIndex,
  getNativeScrollerKeyboardTarget,
  getNativeScrollerProgress,
  getNativeScrollerScrollBehavior,
  isNativeScrollerNestedControl,
} from "@/components/public-v2/interactions/native-scroller-utils";

describe("native scroller utilities", () => {
  it("keeps the initial active index within the item count", () => {
    expect(clampNativeScrollerIndex(-2, 6)).toBe(0);
    expect(clampNativeScrollerIndex(8, 6)).toBe(5);
    expect(clampNativeScrollerIndex(2, 6)).toBe(2);
  });

  it("does not loop when moving beyond either end", () => {
    expect(getNativeScrollerKeyboardTarget("ArrowLeft", 0, 4)).toBe(0);
    expect(getNativeScrollerKeyboardTarget("ArrowRight", 3, 4)).toBe(3);
  });

  it("maps only the supported viewport keyboard commands", () => {
    expect(getNativeScrollerKeyboardTarget("Home", 2, 4)).toBe(0);
    expect(getNativeScrollerKeyboardTarget("End", 1, 4)).toBe(3);
    expect(getNativeScrollerKeyboardTarget("ArrowLeft", 2, 4)).toBe(1);
    expect(getNativeScrollerKeyboardTarget("ArrowRight", 2, 4)).toBe(3);
    expect(getNativeScrollerKeyboardTarget("PageDown", 2, 4)).toBeNull();
    expect(getNativeScrollerKeyboardTarget(" ", 2, 4)).toBeNull();
  });

  it("reports an accurate visible progress value", () => {
    expect(getNativeScrollerProgress(1, 6)).toEqual({ current: 2, total: 6, ratio: 2 / 6 });
    expect(getNativeScrollerProgress(9, 3)).toEqual({ current: 3, total: 3, ratio: 1 });
  });

  it("uses instant browser scrolling when reduced motion is requested", () => {
    expect(getNativeScrollerScrollBehavior(true)).toBe("auto");
    expect(getNativeScrollerScrollBehavior(false)).toBe("smooth");
  });

  it("does not treat a missing event target as a nested control", () => {
    expect(isNativeScrollerNestedControl(null)).toBe(false);
  });
});

describe("public tracking wording", () => {
  it("does not promise anonymous order lookup", () => {
    expect(anonymousTracking).toEqual({
      href: "/account/orders",
      actionLabel: "Sign in to track",
      supportingText: "Sign in to view your orders.",
    });
  });
});
