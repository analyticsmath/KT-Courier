# KT Couriers Phase R12 — User Reference Translation & System Principles

> **Audit Context**: Formal Design System Translation of 18 User-Supplied Dashboard References  
> **Target Identity**: Editorial Operations (Application-side extension of Editorial Freight)  
> **Status**: LOCKED DESIGN DIRECTIVES

---

## 1. Executive Summary & Design Translation Rules

The user provided eighteen dashboard design reference categories covering logistics, finance, healthcare, social media, HR, project management, mobile tracking, and commerce. 

While public-facing KT Couriers (R1–R11) is cinematic, image-led, and dark-themed (`#08233f`), the protected dashboard application must be:
- Denser, quieter, and highly task-oriented.
- Source-backed and permission-aware.
- Clean and legible on white and cool mineral gray canvases (`#ffffff`, `#f8fafc`, `#e2e8f0`).
- Free from generic SaaS visual tropes (rainbow KPI cards, floating 3D glass, purple-heavy themes).

---

## 2. Reference Category Translation Matrix

| Reference Category | Transferable Pattern Adopted | Rejection & Anti-Pattern Avoided | Operational Rationale |
| :--- | :--- | :--- | :--- |
| **1. Social Media Overview** | Right-side contextual rail for recent audit activity and notifications. | Purple gradients, dark saturated metric fills, vanity follower metrics. | Operations require quiet focus; right rail presents actionable secondary context. |
| **2. Healthcare & Patients** | Compact agenda timeline and exception-focused patient/record status. | Pastel rainbow status cards, oversized status tags, decorative illustrations. | Status must be semantic and restrained; patient-style record details match order tracking. |
| **3. Invoicing & Invoices** | Dense tabular presentation with explicit monetary precision and dual-action rows. | Tiny low-contrast typography, missing column headers, generic status badges. | Financial legibility requires crisp tabular figures and high-contrast status indicators. |
| **4. Education & Courses** | Multi-step progress steppers and task completion checklists. | Gamified badges, floating progress bubbles, decorative 3D trophies. | Driver and merchant onboarding benefit from linear steppers without juvenile gamification. |
| **5. Booking & Scheduling** | Operational day timeline, dispatch calendar grid, and agenda view. | Full-month calendar shrunk into mobile views, drag-and-drop without confirmation. | Mobile scheduling requires agenda strips; desktop supports dispatch timelines. |
| **6. Jewellery Management** | High-density record cards with crisp thumbnail media frames. | Heavy drop shadows, floating cards, unnecessary card hover lift animations. | Store catalog management demands high item density and clear inventory counts. |
| **7. Finance & Banking** | Double-entry ledger summary cards and reconciliation discrepancy lists. | Fake yield charts, speculative financial projections, multi-colored graph series. | Financial UI must be 100% source-backed from immutable ledger DTOs. |
| **8. Project Management** | Asymmetric grid layout (70% primary workspace, 30% contextual rail). | Universal Kanban boards for non-kanban workflows, floating modal details. | Split view preserves list context while detail workspace displays complete record data. |
| **9. HR & Employee Portal** | Clear applicant progression pipeline and document checklist drawers. | Promotional "upgrade plan" banners inside internal operational workspaces. | Admin applicant review must be clean, private, and free from commercial clutter. |
| **10. Logistics & Tracking** | Live status timeline, map frame with route overlay, and driver OTP entry. | Decorative 3D trucks, fake live GPS telemetry, non-geocoded coordinates. | Logistics tracking must use real geocoded coordinates and canonical status steps. |
| **11. Mobile Dashboards** | Bottom navigation bar (4-5 destinations), full-screen detail routes. | Desktop multi-column tables compressed directly into mobile viewports. | Compact viewports require structured record cards and clear detail route transitions. |
| **12. Compact Component Studies** | Metric tiles with explicit comparison labels and direct textual indicators. | Single-number cards with no context, circular gauge charts for simple percentages. | Every metric tile must state its time range, currency, and comparison baseline. |

---

## 3. Adopted vs. Rejected Design Principles

### 3.1 Adopted Principles (LOCKED FOR R13+)
1. **Asymmetric Grid Composition**: Standard desktop layouts allocate 8 to 9 columns for primary operational tables/queues and 3 to 4 columns for contextual rails (agenda, summary, activity).
2. **Compact Metric Layer**: KPI cards at page tops are capped at 48px to 64px height, displaying metric title, formatted value, time range, and trend.
3. **List-Detail Architecture**: Complex entity inspection (Orders, Refunds, Withdrawals, Applicants) uses a master list view coupled with a detail workspace or side drawer.
4. **Restrained Color Palette**:
   - **Canvas**: Pure White (`#ffffff`), Mineral Near-White (`#f8fafc`), Mineral Border (`#e2e8f0`).
   - **Text**: Carbon (`#0f172a`), Muted Graphite (`#475569`).
   - **Brand Signal**: Oxide Red (`#c92a2a`) used exclusively for key CTA highlights and brand accents.
   - **Operational Accent**: Deep Mineral Teal (`#0e7490`) for primary operational focus.

### 3.2 Rejected Principles (STRICTLY PROHIBITED)
1. **No Rainbow Dashboards**: Eliminates unique card background colors for every metric.
2. **No Fabricated Analytics**: Prohibits fake growth rates, speculative revenue estimates, or unbacked trendlines.
3. **No Decorative 3D Assets**: Rejects 3D vehicles, glossy icons, or floating glassmorphic panels.
4. **No Modal Navigation**: Prohibits opening major entity details inside small modal popups.
5. **No Shrunk Mobile Tables**: Table views must collapse into structured record cards or transition to dedicated mobile detail routes.
