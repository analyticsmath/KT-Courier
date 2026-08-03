# R13 — Illustration Foundation

## Visual system

R13 illustrations are original 2D editorial SVG components: geometric, operational, light-surface friendly, and intentionally sparse. They use carbon, mineral neutral, oxide signal, and deep operational teal. They contain no gradients, text, external resources, embedded business data, copied reference artwork, or role identity colours.

## Four illustrations

| Name | Component | Concept | Semantics | Intended future use |
| --- | --- | --- | --- | --- |
| Parcel desk | `ParcelDeskIllustration` | Parcel on a stable dispatch surface | Decorative by default; optional `role=img` label | Customer empty delivery state, store handoff |
| Route queue | `RouteQueueIllustration` | Connected origin/destination route | Decorative by default; optional label | Driver assignments, dispatch queues |
| Access boundary | `AccessBoundaryIllustration` | Shielded protected workspace | Decorative by default; optional label | Permission and unavailable states |
| Secure ledger | `SecureLedgerIllustration` | Verified record with check | Decorative by default; optional label | Financial reconciliation and completion states |

Desktop panels may use the illustrations up to their natural view-box proportion; mobile layouts keep them compact above copy. They must never sit behind dense data tables, appear as decorative backgrounds to active forms, imply a live operational state, or expose private route, account, payment, location, or fraud data.

## Future roadmap

R14 may map Parcel desk to customer delivery empties. R15/R16 may add source-backed store and driver state mappings. R17–R21 should reuse this visual grammar rather than inventing role-specific art. Any additional illustration must preserve the registry’s data-free, no-gradient, accessible SVG contract.
