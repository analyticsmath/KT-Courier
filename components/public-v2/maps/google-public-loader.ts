"use client";

const SCRIPT_ID = "__kt_google_maps_public_script";
const READY_CALLBACK = "__kt_public_maps_ready";

type LoadState = "idle" | "loading" | "ready" | "error" | "disabled";

let loadState: LoadState = "idle";
const callbacks: Array<() => void> = [];

export function loadPublicGoogleMaps(onReady: () => void, onError?: () => void): void {
  if (typeof window === "undefined") return;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  if (!apiKey) {
    loadState = "disabled";
    onError?.();
    return;
  }

  if (loadState === "ready" && typeof google !== "undefined" && google.maps) {
    onReady();
    return;
  }

  if (loadState === "error" || loadState === "disabled") {
    onError?.();
    return;
  }

  callbacks.push(onReady);

  if (loadState === "loading") return;

  loadState = "loading";

  (window as unknown as Record<string, unknown>)[READY_CALLBACK] = () => {
    loadState = "ready";
    callbacks.forEach((cb) => cb());
    callbacks.length = 0;
  };

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${READY_CALLBACK}&region=ZA`;
  script.async = true;
  script.defer = true;
  script.onerror = () => {
    loadState = "error";
    onError?.();
    callbacks.length = 0;
  };

  document.head.appendChild(script);
}

export function isGoogleMapsLoaded(): boolean {
  return typeof window !== "undefined" && typeof google !== "undefined" && !!google.maps;
}
