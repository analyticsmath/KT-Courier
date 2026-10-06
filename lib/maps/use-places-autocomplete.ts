"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { AddressDto, PlacePrediction } from "./google-maps.types";
import { normalizeGooglePlaceAddress } from "./address-normalizer";
import { GOOGLE_MAPS_AUTH_FAILURE, loadGoogleBrowserMaps } from "./google-browser-loader";

export interface UsePlacesAutocompleteOptions { regionBias?: string; types?: string[] }
export interface UsePlacesAutocompleteReturn {
  apiReady: boolean; apiError: boolean; predictions: PlacePrediction[]; loading: boolean;
  search: (input: string) => void;
  selectPrediction: (placeId: string) => Promise<AddressDto | null>;
  clearPredictions: () => void;
}

export function usePlacesAutocomplete(options: UsePlacesAutocompleteOptions = {}): UsePlacesAutocompleteReturn {
  const [apiReady, setApiReady] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const active = useRef(false);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const session = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const candidates = useRef(new Map<string, google.maps.places.PlacePrediction>());
  useEffect(() => {
    active.current = true;
    const requests = generation;
    const failed = () => { if (active.current) { setApiError(true); setApiReady(false); } };
    window.addEventListener(GOOGLE_MAPS_AUTH_FAILURE, failed);
    void loadGoogleBrowserMaps().then(() => { if (active.current) setApiReady(true); }, failed);
    return () => {
      active.current = false;
      requests.current++;
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener(GOOGLE_MAPS_AUTH_FAILURE, failed);
    };
  }, []);

  const clearPredictions = useCallback(() => {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    setPredictions([]);
    setLoading(false);
  }, []);

  const search = useCallback((input: string) => {
    clearPredictions();
    if (!apiReady || input.trim().length < 3) return;
    const current = generation.current;
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        session.current ??= new google.maps.places.AutocompleteSessionToken();
        const result = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: input.trim(), sessionToken: session.current,
          includedRegionCodes: [options.regionBias?.toLowerCase() || "za"],
        });
        if (!active.current || generation.current !== current) return;
        candidates.current = new Map(result.suggestions.flatMap(s => s.placePrediction ? [[s.placePrediction.placeId, s.placePrediction] as const] : []));
        setPredictions([...candidates.current.values()].slice(0, 5).map(p => ({
          placeId: p.placeId, description: p.text.toString(), mainText: p.mainText?.toString() ?? p.text.toString(), secondaryText: p.secondaryText?.toString() ?? "",
        })));
      } catch { if (active.current && generation.current === current) setPredictions([]); }
      finally { if (active.current && generation.current === current) setLoading(false); }
    }, 350);
  }, [apiReady, options.regionBias, clearPredictions]);

  const selectPrediction = useCallback(async (placeId: string): Promise<AddressDto | null> => {
    const candidate = candidates.current.get(placeId);
    if (!candidate) return null;
    const current = generation.current;
    try {
      const place = candidate.toPlace();
      await place.fetchFields({ fields: ["id", "formattedAddress", "addressComponents", "location"] });
      if (!active.current || generation.current !== current) return null;
      return normalizeGooglePlaceAddress({
        place_id: place.id, formatted_address: place.formattedAddress ?? undefined,
        address_components: place.addressComponents?.map(c => ({ long_name: c.longText ?? "", short_name: c.shortText ?? "", types: c.types })),
        geometry: place.location ? { location: place.location } : undefined,
      });
    } catch { return null; }
    finally { session.current = null; candidates.current.clear(); }
  }, []);
  return { apiReady, apiError, predictions, loading, search, selectPrediction, clearPredictions };
}
