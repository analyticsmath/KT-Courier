"use client";

import { loadGoogleBrowserMaps } from "@/lib/maps/google-browser-loader";
export function loadPublicGoogleMaps(onReady: () => void, onError?: () => void): void {
  void loadGoogleBrowserMaps().then(onReady, () => onError?.());
}
export function isGoogleMapsLoaded(): boolean {
  return typeof window !== "undefined" && typeof google !== "undefined" && !!google.maps;
}
