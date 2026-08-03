"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { marketplaceSearchHref, marketplaceVariantHref } from "@/lib/public-marketplace/routes";

type Suggestion = { title: string; productSlug: string; productReference: string; variantReference: string };

export function StorefrontSearchBox({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const request = useRef<AbortController | null>(null);
  const listboxId = useId();
  const router = useRouter();

  useEffect(() => {
    const value = query.trim();
    request.current?.abort();
    if (value.length < 2) return;
    const controller = new AbortController(); request.current = controller;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/storefront/search/suggestions?q=${encodeURIComponent(value)}`, { signal: controller.signal });
        if (!response.ok) return;
        const payload = await response.json() as { products?: Suggestion[] };
        setItems(payload.products ?? []); setOpen(true); setActive(-1);
      } catch { /* Aborted and unavailable suggestion requests are intentionally silent. */ }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  function submit(value = query) { const normalized = value.trim().slice(0, 160); router.push(marketplaceSearchHref(normalized ? { q: normalized } : {})); setOpen(false); }
  const showSuggestions = query.trim().length >= 2 && open && items.length > 0;
  return <div className="relative w-full max-w-2xl">
    <label className="sr-only" htmlFor="storefront-search">Search products, stores and categories</label>
    <div className="flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-black/10 focus-within:ring-2 focus-within:ring-[var(--kt-brand-blue)]">
      <input id="storefront-search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "ArrowDown" && items.length) { event.preventDefault(); setOpen(true); setActive((current) => Math.min(current + 1, items.length - 1)); } else if (event.key === "ArrowUp" && items.length) { event.preventDefault(); setActive((current) => Math.max(current - 1, 0)); } else if (event.key === "Enter") { event.preventDefault(); if (active >= 0 && items[active]) submit(items[active]!.title); else submit(); } else if (event.key === "Escape") setOpen(false); }} role="combobox" aria-expanded={showSuggestions} aria-controls={listboxId} aria-activedescendant={active >= 0 ? `${listboxId}-${active}` : undefined} aria-autocomplete="list" className="min-w-0 flex-1 rounded-lg px-4 py-3 text-[var(--kt-brand-navy)] outline-none" placeholder="Search products, stores and categories" maxLength={160} />
      <button type="button" onClick={() => submit()} className="rounded-lg bg-[var(--kt-brand-blue)] px-5 py-3 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Search</button>
    </div>
    {showSuggestions && <ul id={listboxId} role="listbox" className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl bg-white p-1 shadow-lg ring-1 ring-black/10">
      {items.map((item, index) => <li id={`${listboxId}-${index}`} key={`${item.productReference}:${item.variantReference}`} role="option" aria-selected={active === index} className={`cursor-pointer rounded-lg px-4 py-3 ${active === index ? "bg-[var(--kt-studio-mist)]" : ""}`} onMouseDown={(event) => { event.preventDefault(); const href = marketplaceVariantHref(item.productSlug, item.productReference, item.variantReference); if (href) router.push(href); setOpen(false); }}><span className="block font-semibold">{item.title}</span><span className="text-sm text-[var(--kt-text-muted)]">Product suggestion</span></li>)}
    </ul>}
  </div>;
}

type LocationOption = { reference: string; name: string; city?: string; province?: string };
export function LocationContextSelector() {
  const [options, setOptions] = useState<LocationOption[]>([]);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("Choose a service area for contextual availability.");
  useEffect(() => { void fetch("/api/storefront/location/options").then(async (response) => response.ok ? response.json() as Promise<{ options?: LocationOption[] }> : { options: [] }).then((payload) => setOptions(payload.options ?? [])).catch(() => setOptions([])); }, []);
  async function choose(reference: string) { setSelected(reference); if (!reference) { await fetch("/api/storefront/location", { method: "DELETE" }); setMessage("Browsing without a service area."); return; } const response = await fetch("/api/storefront/location/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceAreaReference: reference }) }); const payload = await response.json().catch(() => null) as { context?: { resolutionStatus?: string } } | null; setMessage(payload?.context?.resolutionStatus === "RESOLVED" ? "Service area selected. Availability remains advisory." : "This area is not currently supported."); }
  return <div className="max-w-md"><label className="block text-sm font-semibold" htmlFor="storefront-location">Location context</label><select id="storefront-location" value={selected} onChange={(event) => void choose(event.target.value)} className="mt-2 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-[var(--kt-brand-navy)]"><option value="">Browse without a service area</option>{options.map((option) => <option key={option.reference} value={option.reference}>{option.name}</option>)}</select><p className="mt-2 text-sm text-[var(--kt-text-muted)]" role="status">{message}</p></div>;
}
