"use client";

// Client-only hook. Loads Google Maps Places API on demand and returns
// autocomplete predictions + place details.
// Requires @types/google.maps for type safety on the google.maps.* globals.

/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState, useCallback } from "react";
import type { AddressDto, PlacePrediction } from "./google-maps.types";
import { normalizeGooglePlaceAddress } from "./address-normalizer";

const SCRIPT_ID = "__kt_gmaps_script";
const READY_CALLBACK = "__kt_maps_ready";
const DEBOUNCE_MS = 350;

type LoadState = "idle" | "loading" | "ready" | "error" | "disabled";

// ─── Global script loader (singleton) ────────────────────────────────────────

let loadState: LoadState = "idle";
const readyCallbacks: Array<() => void> = [];

function loadGoogleMapsScript(apiKey: string, onReady: () => void): void {
  if (loadState === "ready") {
    onReady();
    return;
  }
  if (loadState === "error" || loadState === "disabled") return;

  readyCallbacks.push(onReady);

  if (loadState === "loading") return;

  loadState = "loading";

  (window as unknown as Record<string, unknown>)[READY_CALLBACK] = () => {
    loadState = "ready";
    readyCallbacks.forEach((cb) => cb());
    readyCallbacks.length = 0;
  };

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=${READY_CALLBACK}`;
  script.async = true;
  script.defer = true;
  script.onerror = () => {
    loadState = "error";
  };

  document.head.appendChild(script);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UsePlacesAutocompleteOptions {
  regionBias?: string;
  types?: string[];
}

export interface UsePlacesAutocompleteReturn {
  apiReady: boolean;
  apiError: boolean;
  predictions: PlacePrediction[];
  loading: boolean;
  search: (input: string) => void;
  selectPrediction: (placeId: string) => Promise<AddressDto | null>;
  clearPredictions: () => void;
}

export function usePlacesAutocomplete(
  options: UsePlacesAutocompleteOptions = {}
): UsePlacesAutocompleteReturn {
  const apiKey = typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "")
    : "";

  const [apiReady, setApiReady] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);

  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const placeholderDivRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!apiKey) {
      return;
    }

    loadGoogleMapsScript(apiKey, () => {
      try {
        autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
        placeholderDivRef.current = document.createElement("div");
        placesServiceRef.current = new google.maps.places.PlacesService(
          placeholderDivRef.current
        );
        setApiReady(true);
      } catch {
        setApiError(true);
      }
    });

    // Handle auth failure (invalid key)
    (window as unknown as Record<string, unknown>)["gm_authFailure"] = () => {
      loadState = "error";
      setApiError(true);
    };
  }, [apiKey]);

  const search = useCallback(
    (input: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!input.trim() || input.length < 3) {
        setPredictions([]);
        return;
      }

      if (!apiReady || !autocompleteServiceRef.current) {
        return;
      }

      debounceRef.current = setTimeout(() => {
        setLoading(true);
        autocompleteServiceRef.current!.getPlacePredictions(
          {
            input,
            types: options.types ?? ["address", "establishment"],
            componentRestrictions: options.regionBias
              ? { country: options.regionBias }
              : undefined,
          },
          (results, status) => {
            setLoading(false);
            if (
              status === google.maps.places.PlacesServiceStatus.OK &&
              results
            ) {
              setPredictions(
                results.slice(0, 5).map((r) => ({
                  placeId: r.place_id,
                  description: r.description,
                  mainText: r.structured_formatting.main_text,
                  secondaryText: r.structured_formatting.secondary_text ?? "",
                }))
              );
            } else {
              setPredictions([]);
            }
          }
        );
      }, DEBOUNCE_MS);
    },
    [apiReady, options.regionBias, options.types]
  );

  const selectPrediction = useCallback(
    (placeId: string): Promise<AddressDto | null> => {
      return new Promise((resolve) => {
        if (!placesServiceRef.current) {
          resolve(null);
          return;
        }

        placesServiceRef.current.getDetails(
          {
            placeId,
            fields: [
              "formatted_address",
              "place_id",
              "address_components",
              "geometry",
            ],
          },
          (place, status) => {
            if (
              status === google.maps.places.PlacesServiceStatus.OK &&
              place
            ) {
              resolve(normalizeGooglePlaceAddress(place as Parameters<typeof normalizeGooglePlaceAddress>[0]));
            } else {
              resolve(null);
            }
          }
        );
      });
    },
    []
  );

  const clearPredictions = useCallback(() => {
    setPredictions([]);
  }, []);

  return {
    apiReady,
    apiError,
    predictions,
    loading,
    search,
    selectPrediction,
    clearPredictions,
  };
}
