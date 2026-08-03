"use client";

import React, { useState } from "react";

export type SponsoredDisclosureProps = {
  placementCode?: string;
  storeName?: string;
};

export default function SponsoredDisclosure({ placementCode = "N/A", storeName = "Merchant" }: SponsoredDisclosureProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block">
      {/* Sponsored indicator button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-[10px] font-medium text-slate-300 transition-all cursor-pointer shadow-sm hover:scale-102"
      >
        <span>Sponsored</span>
        <svg className="w-2.5 h-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* Slide-out drawer/modal backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div
            className="fixed inset-0"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer content panel */}
          <div className="relative w-full max-w-md h-full bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between shadow-2xl animate-slide-in">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-100">Advertising Transparency</h2>
                  <p className="text-xs text-slate-400 mt-1">Why am I seeing this sponsored placement?</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Explanations */}
              <div className="space-y-4 text-sm text-slate-300">
                <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/80 space-y-2">
                  <h3 className="font-semibold text-indigo-400">Contextual Relevance</h3>
                  <p className="text-xs leading-relaxed text-slate-400">
                    This item is displayed because it matches the search keywords, category paths, or collection surfaces you are currently viewing.
                  </p>
                </div>

                <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/80 space-y-2">
                  <h3 className="font-semibold text-cyan-400">Merchant Sponsor</h3>
                  <p className="text-xs leading-relaxed text-slate-400">
                    The merchant <strong className="text-slate-200">{storeName}</strong> has paid a cost-per-click fee to highlight their product in the <strong className="text-slate-200">{placementCode}</strong> slot.
                  </p>
                </div>

                <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800/80 space-y-2">
                  <h3 className="font-semibold text-emerald-400">Your Privacy</h3>
                  <p className="text-xs leading-relaxed text-slate-400">
                    We do NOT use your sensitive personal data, off-site tracking history, or private demographic profiles to target advertisements on KT Couriers.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-800 pt-4 flex justify-between items-center text-[10px] text-slate-500 font-mono">
              <span>Placement: {placementCode}</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-xs transition-colors"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
