"use client";

let promise: Promise<void> | null = null;
export const GOOGLE_MAPS_AUTH_FAILURE = "kt:google-maps-auth-failure";

/** A single Places/Maps/Marker loader shared by every public and account map. */
export function loadGoogleBrowserMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Maps require a browser."));
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  if (!key) return Promise.reject(new Error("The browser Maps key is not configured."));
  if (promise) return promise;
  promise = new Promise<void>((resolve, reject) => {
    const globals = window as unknown as Record<string, unknown>;
    const callback = "__kt_maps_ready";
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      delete globals[callback];
      if (error) reject(error); else resolve();
    };
    const timeout = setTimeout(() => finish(new Error("Maps loading timed out.")), 20_000);
    globals.gm_authFailure = () => {
      window.dispatchEvent(new Event(GOOGLE_MAPS_AUTH_FAILURE));
      finish(new Error("Maps authentication failed."));
    };
    globals[callback] = () => finish();
    if (typeof google !== "undefined" && google.maps?.importLibrary) {
      Promise.all([google.maps.importLibrary("maps"), google.maps.importLibrary("places"), google.maps.importLibrary("marker")]).then(() => finish(), () => finish(new Error("Maps libraries are unavailable.")));
      return;
    }
    const script = document.createElement("script");
    script.id = "__kt_gmaps_script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,marker&loading=async&callback=${callback}&region=ZA&v=weekly`;
    script.async = true;
    script.onerror = () => finish(new Error("Maps could not be loaded."));
    document.head.appendChild(script);
  });
  return promise;
}
