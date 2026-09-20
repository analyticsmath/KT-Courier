"use client";

import { useEffect, useRef } from "react";

const predecodedCache = new Set<string>();

/**
 * Predecode actor states just in time.
 * Prevents frame drops or visual blanking during quick masked state switches.
 * Never loads all 74 states at boot; only current, next, and next+1 for the active scene.
 * Invariant: Failed decodes are NOT cached as successes.
 */
export function predecodeActorMedia(srcs: (string | undefined | null)[]): Promise<void[]> {
  if (typeof window === "undefined") return Promise.resolve([]);

  const promises = srcs
    .filter((src): src is string => Boolean(src && !predecodedCache.has(src)))
    .map((src) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.src = src;
        if (typeof img.decode === "function") {
          img
            .decode()
            .then(() => {
              predecodedCache.add(src);
              resolve();
            })
            .catch(() => {
              // INVARIANT: Do not cache failed decodes as successes
              resolve();
            });
        } else {
          img.onload = () => {
            predecodedCache.add(src);
            resolve();
          };
          img.onerror = () => {
            // INVARIANT: Do not cache failed decodes as successes
            resolve();
          };
        }
      });
    });

  return Promise.all(promises);
}

/**
 * React hook to predecode a small set of imminent actor states for a scene.
 */
export function useActorPredecode(srcs: (string | undefined | null)[]) {
  const lastKeyRef = useRef<string>("");

  useEffect(() => {
    const validSrcs = srcs.filter((s): s is string => Boolean(s));
    const key = validSrcs.join("|");
    if (key && key !== lastKeyRef.current) {
      lastKeyRef.current = key;
      predecodeActorMedia(validSrcs);
    }
  }, [srcs]);
}
