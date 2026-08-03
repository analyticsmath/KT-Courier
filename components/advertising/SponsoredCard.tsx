/* eslint-disable @next/next/no-img-element */
"use client";

import React from "react";
import SponsoredDisclosure from "./SponsoredDisclosure";

export type SponsoredCardProps = {
  sponsoredObjectType: "PRODUCT" | "STORE";
  layout: "desktop" | "tablet" | "compact_mobile" | "rail" | "discovery" | "search" | "category" | "collection" | "related";
  placementCode: string;
  title: string;
  storeName: string;
  priceAmount?: string;
  destinationUrl: string;
  imageUrl?: string;
};

export default function SponsoredCard({
  sponsoredObjectType,
  layout,
  placementCode,
  title,
  storeName,
  priceAmount,
  destinationUrl,
  imageUrl
}: SponsoredCardProps) {
  // Determine CSS classes based on viewport layouts
  const getLayoutClasses = () => {
    switch (layout) {
      case "compact_mobile":
        return "flex gap-3 p-3 rounded-lg border border-slate-800 bg-slate-900/60 text-xs w-full";
      case "tablet":
        return "flex flex-col p-4 rounded-xl border border-slate-800 bg-slate-900/80 text-sm md:w-64";
      case "rail":
        return "flex-shrink-0 w-48 p-3 rounded-lg border border-indigo-950 bg-slate-900/90 text-xs";
      case "discovery":
        return "flex items-center justify-between p-4 rounded-xl border border-dashed border-indigo-500/30 bg-indigo-950/20 w-full";
      case "desktop":
      default:
        return "flex flex-col p-5 rounded-2xl border border-slate-800 bg-slate-950 hover:bg-slate-900/80 transition-all shadow-lg w-full max-w-sm";
    }
  };

  return (
    <article 
      className={getLayoutClasses()}
      aria-label={`Sponsored ${sponsoredObjectType === "PRODUCT" ? "product" : "store"}: ${title}`}
      data-placement-code={placementCode}
    >
      {/* Sponsored Indicator - Visible, not in tooltip, accessible */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5" aria-live="polite">
          <span 
            className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/50"
            role="status"
          >
            Sponsored
          </span>
          <span className="sr-only">This is a paid sponsored advertisement.</span>
        </div>
        <SponsoredDisclosure placementCode={placementCode} storeName={storeName} />
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-2">
        {imageUrl && (
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-slate-800 relative">
            <img 
              src={imageUrl} 
              alt={title}
              className="h-full w-full object-cover transition-transform hover:scale-105"
              loading="lazy"
            />
          </div>
        )}
        
        <div>
          <h3 className="font-bold text-slate-100 line-clamp-1">{title}</h3>
          <p className="text-xs text-slate-400 font-medium">{storeName}</p>
        </div>

        {sponsoredObjectType === "PRODUCT" && priceAmount && (
          <div className="flex items-center justify-between">
            <span className="text-indigo-400 font-bold">R {priceAmount}</span>
          </div>
        )}
      </div>

      {/* Redirect CTA Link */}
      <div className="mt-3">
        <a 
          href={destinationUrl}
          className="inline-flex items-center justify-center w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          View {sponsoredObjectType === "PRODUCT" ? "Product" : "Store"}
        </a>
      </div>
    </article>
  );
}
