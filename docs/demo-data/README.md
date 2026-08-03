# KT Couriers — Full Demonstration Dataset Guide

## Executive Overview

This document describes the comprehensive, realistic ~13-month demonstration dataset representing active operations of KT Couriers from **1 July 2025 through 30 July 2026**.

The dataset is populated in the dedicated local disposable database `kt_courier_demo_full` and provides interactive, realistic demonstration data across all 15 platform roles, dashboards, and core business workflows without requiring live external provider API keys.

---

## Shared Login Credentials

All demonstration accounts use a uniform password for easy local manual testing and role switching:

- **Shared Password**: `KT-Demo-2026!`
- **Domain**: `@demo.ktcouriers.test`

---

## Dataset Scope & Entity Inventory

| Category | Count | Summary / Notes |
|---|---|---|
| **Users** | `927` | Super Admin (1), Admins (16), Customers (500), Drivers (80), Promoters (50), Store Owners (40), Applicants (240) |
| **Stores** | `40` | 34 Active stores across SA metros, 4 Pending, 2 Suspended |
| **Drivers** | `80` | 70 Active (Available & On Delivery), 5 Pending, 5 Suspended |
| **Promoters** | `50` | Active & Suspended promoters with referral links & earnings |
| **Vacancies & Applications** | `12` / `2,400` | Recruitment pipeline across 12 openings in 5 stages |
| **Catalog Products / Variants** | `840` / `1,260` | Published products across 32 active stores with images & snapshots |
| **Courier Delivery Orders** | `2,500` | 2,000 Delivered, 125 In Transit, 125 Pending, 125 Cancelled, 125 Failed |
| **Marketplace Store Orders** | `1,600` | 1,520 Confirmed & Settled, 80 Cancelled |
| **Notifications & Reports** | `100` / `6` | Outbox notification logs and canonical report export artifacts |

---

## Operational CLI Commands

The following npm scripts manage the demonstration environment:

```bash
# Start local PostgreSQL container (port 5433)
npm run db:start

# Execute full database reset (clears and re-seeds kt_courier_demo_full)
npm run demo:reset

# Seed full demonstration dataset (~180 seconds)
npm run demo:seed

# Run database entity & invariant verification script
npm run demo:verify

# Print interactive catalog of demo accounts
npm run demo:accounts
```

---

## Providerless Validation & External API Status

KT Couriers is structured to allow full local development and manual browser testing without external third-party API dependencies:

- **Payments**: Local PayFast development adapter simulates payment callbacks and webhook signatures.
- **Geocoding & Maps**: Local spatial fallback adapters supply coordinates for South African metropolitan areas.
- **Notifications**: Email, SMS, WhatsApp, and Push notifications route to the local database outbox table (`Notification`).

### Release Readiness Classification
```
INTERNALLY COMPLETE — EXTERNAL API CONFIGURATION REQUIRED
```
All internal code, schema migrations, business logic, role dashboards, ledger accounting, and seed data are **100% complete and validated**. Production deployment requires configuring production credentials in `.env` for PayFast, Google Maps, SMTP, SMS gateway, and Push notification services.
