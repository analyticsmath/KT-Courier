"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mediaQuery = window.matchMedia("(pointer: fine)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: fine)").matches;
}

function getServerSnapshot() {
  return false;
}

export function useFinePointer(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
