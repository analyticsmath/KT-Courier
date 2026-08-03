# KT Couriers Phase R12 — Dashboard Illustration System Specification

> **Audit Context**: Protected Application Illustration System Specification  
> **Style**: Custom 2D Editorial (Geometric, Human, Operational)  
> **Status**: APPROVED ILLUSTRATION CANDIDATE MAP

---

## 1. Illustration Style & Aesthetic Directives

The protected application requires custom 2D editorial illustrations that feel human, operational, and restrained. Illustrations serve to guide users through empty states, onboarding workflows, permission barriers, and completion confirmation without cluttering dense data screens.

### 1.1 Visual Characteristics
- **Art Style**: Crisp vector geometry combined with clean linework and subtle human touches.
- **Palette Constraint**:
  - Primary Carbon (`#0f172a`)
  - Pure White (`#ffffff`)
  - Cool Mineral Neutral (`#f1f5f9` / `#cbd5e1`)
  - Accent Oxide Signal (`#c92a2a`)
  - Operational Deep Teal (`#0e7490`)
- **Scalability**: Designed for vector rendering (SVG) at 120x120px (compact), 200x200px (standard), and 320x240px (hero panels).

### 1.2 Prohibited Styles
- No 3D glossy renders or claymorphism.
- No generic AI-generated floating robots.
- No cartoon delivery trucks with smiling faces.
- No purple or pastel rainbow color gradients.
- No illustrations placed behind dense data tables or active forms.

---

## 2. Empty & Unavailable State Candidate Map

| Candidate Key | Route / Context | Operational Purpose | Visual Concept | Required Action Button |
| :--- | :--- | :--- | :--- | :--- |
| `ILLUS_NO_ACTIVE_DELIVERY` | `/account/orders` | Customer has no in-transit delivery | Editorial parcel box sitting on a geometric pedestal | "Request Delivery" |
| `ILLUS_DELIVERY_COMPLETED` | `/account/orders/[id]` | Successful delivery completion state | Clean clipboard with checkmark and stamp | "View Receipt" / "Back to Orders" |
| `ILLUS_NO_ASSIGNMENTS` | `/driver/assignments` | Driver queue has no pending dispatch offers | Stylized route map with pulse node | "Refresh Availability" |
| `ILLUS_DRIVER_AWAITING_APPROVAL` | `/driver` | Onboarding driver awaiting license check | Verified document shield with subtle hourglass | "Check Document Status" |
| `ILLUS_STORE_SETUP` | `/store` | New merchant completing pickup details | Storefront facade with open sign & checklist | "Complete Store Setup" |
| `ILLUS_MARKETPLACE_LOCKED` | `/store/catalog` | Catalog feature locked by production lock | Secure editorial padlock with key outline | "Learn More" |
| `ILLUS_NO_REFERRALS` | `/promoter/referrals` | Promoter has zero conversions | Share link icon emitting geometric signals | "Copy Referral Code" |
| `ILLUS_DEVELOPER_NO_KEYS` | `/developers` | Developer account has no active API keys | Server node with connection terminal | "Generate API Key" |
| `ILLUS_NO_NOTIFICATIONS` | `/*/notifications` | Zero unread notification messages | Quiet inbox tray with clean bell outline | "Notification Settings" |
| `ILLUS_PERMISSION_DENIED` | All Roles | User lacks required `PermissionKey` | Shield lock with contextual boundary line | "Contact Administrator" |
| `ILLUS_RECRUITMENT_EMPTY` | `/applicant/applications` | Candidate has no active applications | Open job folder with editorial pin | "Browse Openings" |
| `ILLUS_PAYMENT_PENDING` | `/(payments)/*` | Payfast payment awaiting ITN confirmation | Secure credit card passing through verification node | "Check Payment Status" |
| `ILLUS_SEARCH_NO_RESULTS` | `/*/search` | Query returned zero data records | Magnifying glass inspecting empty ledger grid | "Clear Filters" |

---

## 3. Implementation Specification for R13+

All illustrations will be constructed as accessible SVG components under `components/ui/illustrations/`:
- **Prop Interface**: `width`, `height`, `className`, `ariaLabel`.
- **Dark Mode / Contrast**: High contrast vector paths ensuring 4.5:1 ratio against light canvas (`#ffffff`) and mineral surfaces (`#f8fafc`).
- **Zero Asset Dependencies**: Built directly as lightweight React SVG components without external image file overhead.
