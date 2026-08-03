# Storefront UX and performance research

The design favours familiar marketplace patterns: immediate search, category
entry points, offer comparison, clear exact ZAR prices, honest availability and
recoverable zero-result states. Components are server-first with one small
predictive-search client island. Performance budgets: HTML ≤ 100KB, initial JS
≤ 180KB gzipped, primary image ≤ 250KB, initial images ≤ 700KB, search payload
≤ 200KB and product-list payload ≤ 350KB. LCP ≤2.5s, INP ≤200ms and CLS ≤0.1 are
targets only, pending browser proof.

