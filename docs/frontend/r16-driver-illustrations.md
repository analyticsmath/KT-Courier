# R16 — Driver Illustrations

R16 reuses only the R13 local SVG illustration system. It adds no raster asset, external illustration package, or generated driver/customer image.

| Illustration | State mapping | Semantics | Mobile and desktop usage | Prohibited usage |
| --- | --- | --- | --- | --- |
| `components/protected-v2/illustrations/RouteQueueIllustration.tsx` | No assignment, no pickup-ready work, restricted/account state | A restrained abstract route with origin and destination nodes; never a live map | Compact empty/restricted panels, 120–160px wide | Not behind dense records, not a route path, not distance/ETA/navigation evidence. |
| `components/protected-v2/illustrations/SecureLedgerIllustration.tsx` | No earning records | A restrained financial-record state | Earnings empty state | Not a payout-provider state, withdrawal action, or financial performance chart. |
| `components/protected-v2/illustrations/AccessBoundaryIllustration.tsx` | Missing driver profile | A protected account boundary | Home profile-unavailable state | Not a claim of approval, compliance success, or permission override. |

The shared palette stays carbon, white/mineral neutrals, oxide signal, and operational teal. There is no purple, ivory, gradient, glass treatment, decorative map, animated vehicle, or illustration behind an active form.
