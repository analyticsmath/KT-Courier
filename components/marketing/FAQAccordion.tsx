"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
}

export function FAQAccordion({ items }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={index}
            className={cn(
              "overflow-hidden rounded-[1.35rem] bg-[var(--kt-surface)] shadow-sm transition-shadow",
              isOpen && "kt-card-shadow"
            )}
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--kt-blue-soft)] sm:px-6"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-extrabold text-[var(--kt-brand-navy)]">{item.question}</span>
              <span
                className={cn(
                  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--kt-blue-soft)] text-[var(--kt-brand-blue)] transition-transform duration-200",
                  isOpen && "rotate-180 bg-[var(--kt-brand-blue)] text-white"
                )}
                aria-hidden="true"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>
            {isOpen && (
              <div className="bg-[var(--kt-surface)] px-5 pb-5 pt-1 sm:px-6">
                <p className="max-w-2xl text-sm leading-7 text-[var(--kt-text-soft)]">{item.answer}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
