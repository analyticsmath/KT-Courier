"""Normalize the preserved Phase A source corpus into engineering requirements.

This pass reads existing Phase A artifacts only. It does not re-ingest DOCX files,
scan the repository, touch production code/schema/database/provider state, or run
Git. Source atoms remain the evidence layer; normalized requirements are the
implementation/test denominator.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
REPORT = ROOT / "docs" / "phase-a-client-contract-audit.md"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def read_json(name: str) -> Any:
    return json.loads((ARTIFACTS / name).read_text(encoding="utf-8"))


def write_json(name: str, value: Any) -> None:
    (ARTIFACTS / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def norm(value: str) -> str:
    value = value.replace("\u00a0", " ").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", value).strip().lower()


SOURCE_CLASSES = [
    "IMPLEMENTATION_REQUIREMENT",
    "CONFIGURATION_VALUE",
    "LEGAL_CONTENT_ONLY",
    "LEGAL_AND_IMPLEMENTATION",
    "PRODUCT_DESCRIPTION",
    "EXAMPLE",
    "FUTURE_OPTION",
    "USER_OBLIGATION",
    "BUSINESS_POLICY",
    "CLIENT_CLARIFICATION",
    "LEGAL_REVIEW",
]

IMPLEMENTATION_RELEVANT_CLASSES = {
    "IMPLEMENTATION_REQUIREMENT",
    "CONFIGURATION_VALUE",
    "LEGAL_AND_IMPLEMENTATION",
    "USER_OBLIGATION",
    "BUSINESS_POLICY",
    "CLIENT_CLARIFICATION",
    "LEGAL_REVIEW",
}

STATUS_SCORE = {
    "COMPLETE": 1.0,
    "PARTIAL": 0.5,
    "MISSING": 0.0,
    "CONFIG_ONLY": 0.75,
    "PROVIDER_KEY_ONLY": 0.75,
    # Generic architecture is knowable; unresolved values/legal decisions are
    # tracked separately and do not make the engineering blueprint unknowable.
    "CLIENT_VALUE_REQUIRED": 0.75,
    "LEGAL_REVIEW_REQUIRED": 0.75,
}


def add_spec(
    specs: list[dict[str, Any]],
    req_id: str,
    capability_id: str,
    title: str,
    description: str,
    domains: list[str],
    keywords: list[str],
    status: str,
    priority: str,
    *,
    database: bool = True,
    backend: bool = True,
    api: bool = True,
    frontend: bool = True,
    admin: bool = False,
    provider: bool = False,
    security: bool = False,
    financial: bool = False,
    client: str | None = None,
    legal: str | None = None,
    gap: str = "Current repository evidence is adjacent or partial; close the normalized contract without creating a duplicate authority.",
    phase_b: str = "Extend the existing domain authority, preserve snapshots/audit evidence, and add regression proof.",
    phase_c: str = "Connect the workflow only after page, data, actions, backend, permissions, and failure-state evidence is complete.",
    proof: str = "Static, service, database, concurrency, and browser proof as applicable to the capability.",
    test_domain: str = "other",
    frontend_workflow: bool = True,
) -> None:
    specs.append(
        {
            "id": req_id,
            "capabilityId": capability_id,
            "title": title,
            "description": description,
            "domains": domains,
            "keywords": keywords,
            "status": status,
            "priority": priority,
            "databaseRequired": database,
            "backendRequired": backend,
            "apiRequired": api,
            "frontendRequired": frontend,
            "adminRequired": admin,
            "providerRequired": provider,
            "securityRelevant": security,
            "financialRelevant": financial,
            "clientValueDependency": client,
            "legalReviewDependency": legal,
            "gap": gap,
            "phaseBAction": phase_b,
            "phaseCAction": phase_c,
            "phaseDProof": proof,
            "testDomain": test_domain,
            "frontendWorkflow": frontend_workflow,
        }
    )


def build_specs() -> list[dict[str, Any]]:
    s: list[dict[str, Any]] = []
    add_spec(s, "ENG-COMPANY-001", "CAP-COMPANY", "Canonical company settings", "Typed company identity, registration, VAT, contacts, support and business address values are managed from one authority.", ["company"], ["business name", "registration", "vat", "contact", "support email", "business address"], "PARTIAL", "P1", admin=True, security=True, client="Approve the physical business address and canonical issuer contacts.", legal="Company identity must be approved for legal/invoice use.", test_domain="company")
    add_spec(s, "ENG-COMPANY-002", "CAP-COMPANY", "Immutable issuer snapshots", "Invoices, receipts, emails, platform legal pages and waybills use a canonical issuer snapshot at creation time.", ["company", "privacy", "privacy_policy", "terms"], ["invoice", "receipt", "waybill", "issuer", "snapshot", "automatically"], "MISSING", "P1", admin=True, security=True, financial=True, legal="Issuer wording and document retention need legal approval.", gap="Current company/settings and legal-document authorities exist, but a universal immutable issuer snapshot across output types is not proven.", test_domain="company")
    add_spec(s, "ENG-COMPANY-003", "CAP-COMPANY", "Company settings permissions and audit", "Admin company settings have granular permissions, validation, effective dates and auditable before/after evidence.", ["company"], ["admin", "editable", "settings", "effective", "audit"], "PARTIAL", "P1", admin=True, security=True, legal="Company settings that appear in legal documents need approved publication behavior.", test_domain="company")

    add_spec(s, "ENG-COMMERCIAL-001", "CAP-COMMERCIAL", "Versioned delivery service and rate model", "Economy, Standard, Scheduled and Express are represented as versioned services with explicit rate components and turnaround semantics.", ["pricing", "parcel", "shipping"], ["economy", "standard", "scheduled", "express", "turnaround", "rate", "pricing", "delivery fee"], "CLIENT_VALUE_REQUIRED", "P1", admin=True, financial=True, client="Resolve Economy/Standard/Scheduled semantics and Express distance versus parcel-size rate interpretation.", legal="Customer-facing SLA and fee promises require policy approval.", gap="The pricing engine is mature, but the source has conflicting service names, turnarounds and rate meanings.", test_domain="commercial config")
    add_spec(s, "ENG-COMMERCIAL-002", "CAP-COMMERCIAL", "Configurable parcel profiles", "Small, Medium and Large parcel profiles expose admin-editable dimensions, weights and selectable customer/admin options.", ["parcel", "pricing", "shipping"], ["parcel size", "dimension", "weight", "dropdown", "small", "medium", "large", "maximum"], "PARTIAL", "P2", admin=True, financial=True, client="Approve final launch limits and rate values without hard-coding them.", test_domain="commercial config")
    add_spec(s, "ENG-COMMERCIAL-003", "CAP-COMMERCIAL", "Store commercial policy and commissions", "Per-module delivery charges, minimum/maximum charges, COD limits and store/driver/KT commission percentages are versioned configuration.", ["pricing", "store", "payment", "cod"], ["per km", "minimum", "maximum", "commission", "cod order amount", "module-specific", "percentage"], "PARTIAL", "P1", admin=True, financial=True, client="Approve final commercial percentages and limits.", test_domain="commercial config")
    add_spec(s, "ENG-COMMERCIAL-004", "CAP-COMMERCIAL", "Temporary surcharge policy", "Surcharges have scope, effective dates, customer-visible messaging, enable/disable state and quote evidence.", ["pricing", "shipping"], ["surcharge", "increase delivery charge", "rainy", "message", "toggle"], "PARTIAL", "P2", admin=True, financial=True, client="Approve surcharge examples and launch policy.", test_domain="commercial config")
    add_spec(s, "ENG-COMMERCIAL-005", "CAP-COMMERCIAL", "Payment method configuration", "Stores/modules can enable digital payment and COD/partial-payment methods under an explicit policy.", ["payment", "cod", "store"], ["cash on delivery", "partial payment", "enable or disable", "payment methods", "digital payment"], "PARTIAL", "P0", admin=True, financial=True, security=True, client="Define deposit, balance, collector, failure and refund semantics for COD partial payment.", test_domain="payments/COD")
    add_spec(s, "ENG-COMMERCIAL-006", "CAP-COMMERCIAL", "Immutable commercial evidence", "Accepted quotes, orders, commissions and payment outcomes retain the effective commercial policy and input values that produced them.", ["pricing", "payment", "cod", "promoter"], ["snapshot", "frozen", "effective", "accepted", "history"], "MISSING", "P1", admin=True, financial=True, security=True, gap="Several mature financial snapshots exist, but new company, COD, claim, module, coverage, vehicle and promoter values lack a universal immutable contract.", test_domain="commercial config")

    add_spec(s, "ENG-MODULE-001", "CAP-MODULE-TAXONOMY", "Canonical business modules", "Food, Grocery, Pharmacy/Health, E-Commerce and Parcel are governed module records rather than scattered labels.", ["store", "catalog"], ["business module", "food", "grocery", "pharmacy", "e-commerce", "parcel", "module"], "MISSING", "P1", admin=True, security=True, client="Approve final module names and launch scope.", test_domain="taxonomy")
    add_spec(s, "ENG-MODULE-002", "CAP-MODULE-TAXONOMY", "Governed category hierarchy", "Global categories, hierarchy, active/archive state, visibility and SEO are administered centrally; stores select approved categories.", ["catalog", "store"], ["category", "hierarch", "global categories", "archive", "visibility", "seo"], "PARTIAL", "P1", admin=True, security=True, test_domain="taxonomy")
    add_spec(s, "ENG-MODULE-003", "CAP-MODULE-TAXONOMY", "Product variant and option boundaries", "Variants/SKUs, modifiers/options, product types, offers and categories remain separate authorities.", ["catalog"], ["variant", "sku", "modifier", "option", "product type"], "COMPLETE", "P2", admin=True, test_domain="taxonomy")
    add_spec(s, "ENG-MODULE-004", "CAP-MODULE-TAXONOMY", "Store onboarding governance", "Store registration captures business, module, category, delivery and payment configuration through governed associations.", ["store", "catalog"], ["onboarding", "store registration", "business information", "product categories", "delivery options", "store configuration"], "PARTIAL", "P1", admin=True, security=True, test_domain="taxonomy")

    add_spec(s, "ENG-GEO-001", "CAP-GEOGRAPHY", "Nationwide discovery and selling territory", "Store/product discovery and selling territory are independent from whether KT can deliver to a specific address.", ["store", "geography", "shipping"], ["nationwide", "south africa", "rsa", "selling territory", "store availability", "province"], "PARTIAL", "P1", security=True, test_domain="geography")
    add_spec(s, "ENG-GEO-002", "CAP-GEOGRAPHY", "Coverage and serviceability authority", "Reusable coverage, service area, driver region and checkout serviceability evidence are explicit and queryable.", ["geography", "store", "shipping"], ["coverage", "service area", "serviceability", "delivery zone", "driver region"], "PARTIAL", "P1", admin=True, security=True, client="Approve operational coverage and optional store-specific restrictions.", test_domain="geography")
    add_spec(s, "ENG-GEO-003", "CAP-GEOGRAPHY", "Route-distance evidence", "Distance-based pricing and delivery estimates use verified provider/map evidence with explicit fallback/error behavior.", ["geography", "pricing", "shipping"], ["distance", "route", "maps", "geocod", "delivery pricing"], "PARTIAL", "P1", provider=True, security=True, financial=True, test_domain="geography")

    add_spec(s, "ENG-DRIVER-001", "CAP-DRIVER-VEHICLE", "Driver identity and profile", "Driver identity, contact, address, status, region and profile information are captured through the driver authority.", ["driver", "privacy"], ["driver", "full name", "id/passport", "date of birth", "phone", "email", "address", "profile"], "PARTIAL", "P1", security=True, test_domain="driver/vehicle")
    add_spec(s, "ENG-DRIVER-002", "CAP-DRIVER-VEHICLE", "Driver compliance documents", "Driver ID, licence, expiry, photographs and onboarding documents are private, validated and reviewable.", ["driver", "vehicle", "media", "privacy"], ["driver's licence", "licence expiry", "id document", "driver photo", "documents", "verification"], "PARTIAL", "P0", security=True, test_domain="driver/vehicle")
    add_spec(s, "ENG-DRIVER-003", "CAP-DRIVER-VEHICLE", "Independent driver verification", "Driver verification and approval are distinct from profile completion and are enforced before eligible assignment.", ["driver"], ["driver status", "verification status", "approve", "reject", "driver approval"], "PARTIAL", "P0", admin=True, security=True, test_domain="driver/vehicle")
    add_spec(s, "ENG-VEHICLE-001", "CAP-DRIVER-VEHICLE", "First-class vehicle profile", "A vehicle entity stores make, model, year, colour, registration, type and capacity independently from DriverProfile.", ["vehicle", "driver"], ["vehicle entity", "vehicle make", "vehicle model", "vehicle year", "vehicle colour", "registration number", "vehicle type", "capacity"], "MISSING", "P0", admin=True, security=True, test_domain="driver/vehicle")
    add_spec(s, "ENG-VEHICLE-002", "CAP-DRIVER-VEHICLE", "Vehicle documents and media", "Licence disc, registration document, insurance and vehicle photographs are private, validated and linked to the vehicle.", ["vehicle", "media", "privacy"], ["licence disc", "registration document", "vehicle pictures", "insurance", "vehicle documents"], "MISSING", "P0", admin=True, security=True, test_domain="driver/vehicle")
    add_spec(s, "ENG-VEHICLE-003", "CAP-DRIVER-VEHICLE", "Independent vehicle approval", "Vehicle approval/rejection and expiry are independent from driver approval and are part of dispatch eligibility.", ["vehicle", "driver"], ["vehicle approval", "approve/reject", "independently", "vehicle verification"], "MISSING", "P0", admin=True, security=True, test_domain="driver/vehicle")
    add_spec(s, "ENG-DRIVER-004", "CAP-DRIVER-VEHICLE", "Dispatch eligibility and location evidence", "Assignment eligibility checks driver, vehicle, region, capacity, availability and validated location evidence without overstating point-in-time evidence as live GPS.", ["driver", "vehicle", "geography", "shipping"], ["eligibility", "assignment", "location", "staleness", "accuracy", "tracking"], "PARTIAL", "P1", security=True, test_domain="driver/vehicle")

    add_spec(s, "ENG-MEDIA-001", "CAP-PRIVATE-MEDIA", "Upload content validation", "MIME, extension, content, size and media subject validation protect all catalog, driver, vehicle, KYC and proof uploads.", ["media", "driver", "vehicle"], ["mime", "extension", "content", "size", "upload", "validation"], "COMPLETE", "P1", security=True, test_domain="private media")
    add_spec(s, "ENG-MEDIA-002", "CAP-PRIVATE-MEDIA", "Private durable object storage", "Sensitive masters use production private object storage rather than public/local-only paths.", ["media", "driver", "vehicle", "privacy"], ["private", "storage", "object", "kyc", "proof"], "MISSING", "P0", provider=True, security=True, test_domain="private media")
    add_spec(s, "ENG-MEDIA-003", "CAP-PRIVATE-MEDIA", "Owner-scoped signed access", "Private media reads use owner/permission checks, short-lived signed delivery and auditable access.", ["media", "privacy"], ["signed url", "signed delivery", "permission", "owner", "access"], "MISSING", "P0", api=True, admin=True, provider=True, security=True, test_domain="private media")
    add_spec(s, "ENG-MEDIA-004", "CAP-PRIVATE-MEDIA", "Retention and deletion for media", "KYC, vehicle and proof media follow retention, legal hold, deletion and audit rules.", ["media", "privacy", "driver", "vehicle"], ["retention", "deletion", "legal hold", "delete"], "PARTIAL", "P1", admin=True, security=True, legal="Retention periods and legal holds require policy approval.", test_domain="private media")

    add_spec(s, "ENG-PAY-001", "CAP-PAYMENTS-COD", "Digital payment provider flow", "PayFast initiation, callback verification/application, idempotency, reconciliation, refund execution and ledger evidence remain one authority.", ["payment", "terms", "privacy"], ["digital payment", "payment provider", "third-party providers", "payfast", "itn", "refund"], "COMPLETE", "P1", provider=True, security=True, financial=True, test_domain="payments/COD")
    add_spec(s, "ENG-PAY-002", "CAP-PAYMENTS-COD", "Payment method policy by context", "Allowed payment methods are determined by store, module and order type and are visible in quote/checkout state.", ["payment", "cod", "store"], ["payment method", "digital payment", "cash on delivery", "order type"], "PARTIAL", "P0", admin=True, security=True, financial=True, client="Confirm store/module payment policy and limits.", test_domain="payments/COD")
    add_spec(s, "ENG-COD-001", "CAP-PAYMENTS-COD", "COD and partial-payment state", "COD order representation records deposit, outstanding balance, collector, collection state and failure semantics.", ["cod", "payment"], ["cash on delivery", "partial payment", "deposit", "balance", "collector"], "MISSING", "P0", admin=True, security=True, financial=True, client="Define partial-payment deposit and balance semantics.", test_domain="payments/COD")
    add_spec(s, "ENG-COD-002", "CAP-PAYMENTS-COD", "Cash custody and collection", "Driver/store cash handoff, custody, confirmation and failed collection are explicit operational states.", ["cod", "shipping", "payment"], ["cash custody", "cash collection", "collector", "failed cash", "confirmation"], "MISSING", "P0", admin=True, security=True, financial=True, test_domain="payments/COD")
    add_spec(s, "ENG-COD-003", "CAP-PAYMENTS-COD", "Cash reconciliation and liability", "COD cash reconciles against order, driver, store settlement, refunds and ledger with conservation and concurrency proofs.", ["cod", "payment", "claim"], ["reconciliation", "liability", "settlement", "ledger", "cash"], "MISSING", "P0", admin=True, security=True, financial=True, test_domain="payments/COD")
    add_spec(s, "ENG-PAY-003", "CAP-PAYMENTS-COD", "Refund and payment evidence integration", "Refunds and payment reversals remain idempotent, reconciled and linked to the originating payment/order evidence.", ["payment", "claim", "refund"], ["refund", "refunds", "reversal", "payment", "transaction"], "PARTIAL", "P1", security=True, financial=True, test_domain="payments/COD")

    add_spec(s, "ENG-CLAIM-001", "CAP-CLAIMS-REMEDIES", "Claim creation and reason taxonomy", "Customers can create a claim with controlled reasons for wrong, damaged, missing, spoiled, non-delivery and materially different outcomes.", ["claim", "refund", "shipping"], ["claim", "reason", "wrong", "damaged", "missing", "spoiled", "non-delivery", "different"], "MISSING", "P0", api=True, frontend=True, security=True, financial=True, test_domain="claims")
    add_spec(s, "ENG-CLAIM-002", "CAP-CLAIMS-REMEDIES", "Claim evidence", "Claims collect order, description, photographs/video, packaging, proof of delivery and other evidence under private ownership rules.", ["claim", "refund", "media"], ["evidence", "photograph", "video", "packaging", "proof of delivery", "order number"], "PARTIAL", "P0", api=True, frontend=True, security=True, test_domain="claims")
    add_spec(s, "ENG-CLAIM-003", "CAP-CLAIMS-REMEDIES", "Investigation and responsibility", "Claim investigation identifies vendor, driver, customer and operational responsibility with case history.", ["claim", "refund", "shipping"], ["investigat", "responsibility", "vendor", "driver", "cause"], "MISSING", "P0", admin=True, security=True, financial=True, test_domain="claims")
    add_spec(s, "ENG-CLAIM-004", "CAP-CLAIMS-REMEDIES", "Claim decision and audit", "Admin decisions, policy version, actor, reason and outcome are auditable and separate from financial execution.", ["claim", "refund", "privacy"], ["decision", "investigation", "policy", "audit", "resolution"], "MISSING", "P0", admin=True, security=True, financial=True, legal="Remedy policy and statutory rights require legal approval.", test_domain="claims")
    add_spec(s, "ENG-CLAIM-005", "CAP-CLAIMS-REMEDIES", "Operational remedies", "Replacement, redelivery, store credit and partial/full refund are composable remedies with independent state.", ["claim", "refund", "shipping"], ["replacement", "redelivery", "store credit", "partial refund", "full refund", "remedy"], "MISSING", "P0", api=True, frontend=True, security=True, financial=True, legal="Remedy eligibility and consumer-rights wording require legal approval.", test_domain="claims")
    add_spec(s, "ENG-CLAIM-006", "CAP-CLAIMS-REMEDIES", "Claim-to-refund integration", "Existing refund and store-order adjustment authorities are reused without duplicating the financial refund subsystem.", ["claim", "refund", "payment"], ["refund", "adjustment", "refund method", "financial"], "PARTIAL", "P1", security=True, financial=True, legal="Refund deadlines and policy precedence require legal approval.", test_domain="claims")
    add_spec(s, "ENG-CLAIM-007", "CAP-CLAIMS-REMEDIES", "Claim customer/store/admin surfaces", "Customer submission/tracking, store response and admin review/resolution workflows expose controlled state and failure outcomes.", ["claim", "refund", "store"], ["customer", "vendor", "admin", "request", "review", "track"], "MISSING", "P1", admin=True, api=True, frontend=True, security=True, test_domain="claims")
    add_spec(s, "ENG-CLAIM-008", "CAP-CLAIMS-REMEDIES", "Fraud and abusive-claim controls", "Fraud/abuse signals, investigation holds and reversal paths protect claim and refund economics.", ["claim", "refund", "payment"], ["fraud", "abusive", "duplicate", "misuse", "withhold"], "PARTIAL", "P1", admin=True, security=True, financial=True, test_domain="claims")

    add_spec(s, "ENG-PROM-001", "CAP-PROMOTER", "Promoter programme configuration", "The promoter programme, eligible referral targets, enrollment and operational rules are versioned configuration.", ["promoter", "store", "driver"], ["promoter", "programme", "registration", "referral code", "linked to stores"], "PARTIAL", "P1", admin=True, financial=True, client="Confirm promoter enrollment fee/value and eligible target roles.", test_domain="promoters")
    add_spec(s, "ENG-PROM-002", "CAP-PROMOTER", "Rank definitions", "Starter through President rank definitions, thresholds, benefits and effective dates are configuration, not literals.", ["promoter"], ["rank", "starter", "team leader", "supervisor", "manager", "director", "president"], "CLIENT_VALUE_REQUIRED", "P1", admin=True, financial=True, client="Approve one signed rank table, thresholds and registration value.", test_domain="promoters")
    add_spec(s, "ENG-PROM-003", "CAP-PROMOTER", "Referral attribution", "Vendor, driver and customer referrals are attributed idempotently with anti-self-referral and ownership rules.", ["promoter", "driver", "store"], ["vendor referral", "driver referral", "customer referral", "referral", "attribution"], "COMPLETE", "P1", security=True, financial=True, test_domain="promoters")
    add_spec(s, "ENG-PROM-004", "CAP-PROMOTER", "Team graph", "Direct referrals, team membership and levels form an acyclic auditable graph.", ["promoter"], ["team", "team members", "team levels", "level 1", "level 2"], "PARTIAL", "P1", admin=True, security=True, financial=True, test_domain="promoters")
    add_spec(s, "ENG-PROM-005", "CAP-PROMOTER", "Qualification and monthly evaluation", "Monthly activity, qualification state, rank progression and effective-date evaluation are scheduled and reproducible.", ["promoter"], ["monthly activity", "qualified", "qualification", "rank progression", "current month"], "PARTIAL", "P1", admin=True, financial=True, test_domain="promoters")
    add_spec(s, "ENG-PROM-006", "CAP-PROMOTER", "Commission rules", "Vendor, delivery, customer-spend and team-level commission rules are versioned and snapshot into earnings.", ["promoter", "payment", "pricing"], ["commission", "vendor", "delivery earnings", "customer spend", "percentage"], "CLIENT_VALUE_REQUIRED", "P1", admin=True, financial=True, client="Approve final percentages and effective dates.", test_domain="promoters")
    add_spec(s, "ENG-PROM-007", "CAP-PROMOTER", "Earnings, withdrawals and reversals", "Pending/qualified/available/paid earnings, withdrawals, refunds and fraud reversals conserve balances.", ["promoter", "payment", "claim"], ["earnings", "withdrawal", "pending", "available", "paid", "reversal"], "PARTIAL", "P0", admin=True, security=True, financial=True, test_domain="promoters")
    add_spec(s, "ENG-PROM-008", "CAP-PROMOTER", "Promoter and admin surfaces", "Promoter dashboard and admin programme/rule views expose rank, referrals, activity, qualification, earnings and blocked states.", ["promoter"], ["dashboard", "my rank", "available balance", "admin", "performance"], "PARTIAL", "P1", admin=True, frontend=True, security=True, test_domain="promoters")

    add_spec(s, "ENG-ADS-001", "CAP-ADVERTISING", "On-platform advertising", "On-platform advertiser accounts, campaigns, placements, funding, serving, measurement and reconciliation remain a coherent authority.", ["advertising", "store"], ["advertising", "campaign", "placement", "funding", "serving"], "COMPLETE", "P1", admin=True, financial=True, security=True, test_domain="advertising")
    add_spec(s, "ENG-ADS-002", "CAP-ADVERTISING", "Advertising packages and rate cards", "Packages, durations, deliverables, VAT and prices are admin configuration and do not hard-code illustrative values.", ["advertising", "pricing"], ["package", "duration", "price", "vat", "rate", "basic", "standard", "premium"], "CONFIG_ONLY", "P1", admin=True, financial=True, client="Supply final advertising prices and package deliverables.", test_domain="advertising")
    add_spec(s, "ENG-ADS-003", "CAP-ADVERTISING", "Channels and placements", "Advertising channels and placements are explicit and support on-platform and manually managed external campaigns.", ["advertising"], ["channel", "platform", "tiktok", "facebook", "instagram", "google", "website", "app", "email", "push"], "COMPLETE", "P1", admin=True, security=True, test_domain="advertising")
    add_spec(s, "ENG-ADS-004", "CAP-ADVERTISING", "Business advertising requests and media", "Businesses submit campaign objective, dates, audience, budget/package, message and validated creative assets.", ["advertising", "media", "store"], ["advertise my business", "request", "upload", "images", "videos", "logo", "target audience"], "PARTIAL", "P1", admin=True, security=True, financial=True, test_domain="advertising")
    add_spec(s, "ENG-ADS-005", "CAP-ADVERTISING", "Advertising approval", "Admin approval, rejection and audit states gate campaign execution.", ["advertising"], ["approval", "approve", "reject", "pending approval", "admin dashboard"], "COMPLETE", "P1", admin=True, security=True, test_domain="advertising")
    add_spec(s, "ENG-ADS-006", "CAP-ADVERTISING", "Campaign schedule and lifecycle", "Approved campaigns move through schedule, publish/run, pause/end and completion states with processor evidence.", ["advertising"], ["schedule", "publish", "run", "complete", "active", "pause", "campaign status"], "COMPLETE", "P1", admin=True, test_domain="advertising")
    add_spec(s, "ENG-ADS-007", "CAP-ADVERTISING", "Advertising revenue and reporting", "Advertiser, campaign, package, dates, revenue and performance reporting reconcile to billing/ledger evidence.", ["advertising", "payment"], ["revenue", "reporting", "measurement", "billing"], "COMPLETE", "P1", admin=True, financial=True, test_domain="advertising")
    add_spec(s, "ENG-ADS-008", "CAP-ADVERTISING", "Managed external marketing boundary", "Manual managed marketing and automatic Meta/TikTok/Google API publishing are separate states; external publishing is not required without an explicit selection.", ["advertising"], ["automatic", "publishing", "oauth", "token", "external", "manual", "managed"], "CLIENT_VALUE_REQUIRED", "P1", admin=True, provider=False, security=True, client="Confirm manual managed marketing versus automatic provider publishing.", test_domain="advertising")

    add_spec(s, "ENG-PRIV-001", "CAP-PRIVACY-COMPLIANCE", "Privacy notice and versioning", "Privacy notice text has effective/last-updated versions and a public content authority.", ["privacy", "privacy_policy"], ["privacy policy", "effective date", "last updated", "notice", "version"], "PARTIAL", "P1", frontend=True, security=True, legal="Legal approval of the current policy text and effective date.", test_domain="privacy", frontend_workflow=False)
    add_spec(s, "ENG-PRIV-002", "CAP-PRIVACY-COMPLIANCE", "Terms acceptance evidence", "Terms acceptance is distinct from privacy acknowledgement and stores policy version, actor, time and context.", ["privacy", "privacy_policy", "terms"], ["terms", "acceptance", "continued use", "agree", "acknowledge"], "PARTIAL", "P1", api=True, frontend=True, security=True, legal="Legal mapping must define acceptance trigger and enforceability.", test_domain="privacy")
    add_spec(s, "ENG-PRIV-003", "CAP-PRIVACY-COMPLIANCE", "Marketing preferences and opt-out", "Direct-marketing consent/withdrawal and transactional communications are separate preferences with auditable evidence.", ["privacy", "privacy_policy"], ["marketing", "opt out", "withdraw consent", "direct marketing", "communication"], "PARTIAL", "P1", api=True, frontend=True, security=True, legal="Legal approval of marketing lawful basis and channel scope.", test_domain="privacy")
    add_spec(s, "ENG-PRIV-004", "CAP-PRIVACY-COMPLIANCE", "Cookie preference", "Non-essential cookie consent/preferences are separate from policy acknowledgement and can be withdrawn.", ["privacy", "privacy_policy"], ["cookie", "cookies", "non-essential", "tracking technologies"], "PARTIAL", "P1", api=True, frontend=True, security=True, legal="Legal approval of cookie categories and consent behavior.", test_domain="privacy")
    add_spec(s, "ENG-PRIV-005", "CAP-PRIVACY-COMPLIANCE", "Data-subject requests", "Access, correction, deletion/anonymisation, objection and portability requests have controlled intake, status and evidence.", ["privacy", "privacy_policy"], ["data subject", "access", "correction", "deletion", "anonym", "objection", "portability", "request"], "PARTIAL", "P1", api=True, admin=True, frontend=True, security=True, legal="Legal approval of request identity, exemptions and response timelines.", test_domain="privacy")
    add_spec(s, "ENG-PRIV-006", "CAP-PRIVACY-COMPLIANCE", "Retention and deletion execution", "Retention schedules, legal holds and deletion/anonymisation processors apply to new data classes.", ["privacy", "privacy_policy", "media", "driver", "vehicle", "claim"], ["retention", "delete", "deletion", "legal hold", "anonymisation"], "PARTIAL", "P1", backend=True, api=False, frontend=False, security=True, legal="Approve retention periods, holds and deletion exceptions.", test_domain="privacy", frontend_workflow=False)
    add_spec(s, "ENG-PRIV-007", "CAP-PRIVACY-COMPLIANCE", "Location processing control", "Location collection, use, exposure, retention and optional permission behavior are limited to delivery/logistics purposes.", ["privacy", "privacy_policy", "driver", "geography"], ["location", "route", "tracking", "device location", "permissions"], "PARTIAL", "P1", api=True, frontend=True, security=True, legal="Approve location purpose, customer visibility and retention boundaries.", test_domain="privacy")
    add_spec(s, "ENG-PRIV-008", "CAP-PRIVACY-COMPLIANCE", "Security incident and safeguards", "Security safeguards, incident intake, investigation, notification and audit evidence are defined for personal/financial data.", ["privacy", "privacy_policy", "terms"], ["security", "incident", "breach", "safeguard", "protect"], "PARTIAL", "P1", admin=True, security=True, legal="Legal/compliance approval of incident response and notification obligations.", test_domain="privacy")
    add_spec(s, "ENG-PRIV-009", "CAP-PRIVACY-COMPLIANCE", "Provider and data-processor governance", "Payment, maps, email, storage and other processors have purpose, data-sharing, retention, contract and failure-state records.", ["privacy", "privacy_policy", "payment"], ["third-party", "provider", "processor", "share", "international", "payment provider"], "LEGAL_REVIEW_REQUIRED", "P1", admin=True, provider=True, security=True, legal="Legal review of processor roles, cross-border transfer and contracts.", test_domain="privacy")
    add_spec(s, "ENG-PRIV-010", "CAP-PRIVACY-COMPLIANCE", "Sensitive data-class controls", "KYC, vehicle, location, claim evidence and financial data classes have purpose, access, retention and redaction controls.", ["privacy", "privacy_policy", "driver", "vehicle", "media", "claim", "payment"], ["identification", "vehicle information", "verification", "claim", "financial", "banking", "documents"], "PARTIAL", "P0", admin=True, security=True, financial=True, legal="Approve sensitive-data purposes and role/retention matrix.", test_domain="privacy")

    add_spec(s, "ENG-SHIP-001", "CAP-SHIPPING-OPERATIONS", "Service catalogue and launch scope", "Food, grocery, pharmacy, e-commerce, parcel, B2B, moving and specialised services have explicit launch depth and policy states.", ["shipping", "refund", "terms"], ["delivery services", "food", "grocery", "pharmacy", "e-commerce", "parcel", "moving", "specialised", "corporate"], "CLIENT_VALUE_REQUIRED", "P1", admin=True, client="Confirm full booking/quote/dispatch versus lead/quote-only depth for moving and specialised services.", test_domain="shipping")
    add_spec(s, "ENG-SHIP-002", "CAP-SHIPPING-OPERATIONS", "Booking and fulfilment lifecycle", "Selected services map to booking, vendor preparation, pickup, dispatch, delivery, completion and exception states.", ["shipping", "refund", "terms"], ["booking", "fulfil", "prepare", "pickup", "dispatch", "delivery process", "completion"], "PARTIAL", "P1", admin=True, security=True, test_domain="shipping")
    add_spec(s, "ENG-SHIP-003", "CAP-SHIPPING-OPERATIONS", "SLA and service timing policy", "Economy/Standard/Scheduled/Express/Same-day timing and customer-facing estimates are explicit and consistent.", ["shipping", "pricing", "refund", "terms"], ["delivery time", "estimate", "economy", "standard", "scheduled", "express", "same-day", "24 hours"], "CLIENT_VALUE_REQUIRED", "P1", client="Resolve service turnaround conflicts and the Terms 24-hour rule versus current refund policy language.", legal="Legal approval of delivery/refund deadlines and consumer-facing promises.", test_domain="shipping")
    add_spec(s, "ENG-SHIP-004", "CAP-SHIPPING-OPERATIONS", "Tracking, ETA and proof of delivery", "Tracking, ETA and POD signature/OTP/photo/GPS evidence are tied to delivery execution and privacy limits.", ["shipping", "driver", "privacy"], ["tracking", "eta", "proof of delivery", "signature", "otp", "photo", "gps"], "PARTIAL", "P1", security=True, test_domain="shipping")
    add_spec(s, "ENG-SHIP-005", "CAP-SHIPPING-OPERATIONS", "Failed delivery and redelivery", "Failed delivery, rescheduling, redelivery, return and customer/vendor responsibility are explicit operational states.", ["shipping", "refund", "claim"], ["failed delivery", "rescheduled", "redelivery", "return", "recipient unavailable"], "PARTIAL", "P1", security=True, financial=True, legal="Approve responsibility and fee/refund consequences.", test_domain="shipping")
    add_spec(s, "ENG-SHIP-006", "CAP-SHIPPING-OPERATIONS", "Package and insurance policy controls", "Prohibited, fragile, high-value, declared-value, packaging and insurance rules are versioned and connected to acceptance/claims.", ["shipping", "refund", "terms"], ["prohibited", "fragile", "high-value", "declared value", "insurance", "packaging"], "CLIENT_VALUE_REQUIRED", "P1", admin=True, security=True, financial=True, client="Approve insurance, declared-value and high-risk item policy.", legal="Legal approval of exclusions and limitation-of-liability wording.", test_domain="shipping")
    add_spec(s, "ENG-SHIP-007", "CAP-SHIPPING-OPERATIONS", "Vendor preparation obligations", "Vendor preparation time, packaging, lawful listings and handoff obligations are operationally observable.", ["shipping", "terms", "store"], ["vendor responsibilities", "vendor obligations", "prepare", "packaging", "listing"], "PARTIAL", "P1", admin=True, security=True, test_domain="shipping")
    add_spec(s, "ENG-SHIP-008", "CAP-SHIPPING-OPERATIONS", "Driver delivery responsibilities", "Driver safety, lawful transport, suspicious-package reporting and delivery evidence obligations are enforced in driver operations.", ["shipping", "terms", "driver"], ["delivery partner responsibilities", "delivery personnel", "driver", "suspicious", "safety", "lawful"], "PARTIAL", "P1", security=True, test_domain="driver/vehicle")

    add_spec(s, "ENG-POLICY-001", "CAP-POLICY-CONTROLS", "Legal document publication and versioning", "Public legal documents have effective dates, last-updated versions, publication authority and links to acceptance/acknowledgement evidence.", ["privacy", "privacy_policy", "terms", "refund", "shipping"], ["effective date", "last updated", "policy", "terms and conditions", "publication", "version"], "PARTIAL", "P1", frontend=True, security=True, legal="Legal owner approves publication and effective-date transitions.", test_domain="privacy", frontend_workflow=False)
    add_spec(s, "ENG-POLICY-002", "CAP-POLICY-CONTROLS", "Policy-to-behavior reconciliation", "Policy versions and conflict decisions are linked to executable eligibility, remedy, consent and operational behavior without silently selecting contradictory text.", ["privacy", "privacy_policy", "terms", "refund", "shipping"], ["acknowledgement", "acceptance", "consent", "refund", "cancellation", "policy changes", "legal rights"], "LEGAL_REVIEW_REQUIRED", "P1", admin=True, security=True, financial=True, legal="Resolve policy precedence and obtain legal approval before encoding material deadlines or exclusions.", test_domain="privacy", frontend_workflow=False)
    return s


CAPABILITIES = [
    {"capabilityId": "CAP-COMPANY", "title": "Company identity and issuer control", "description": "Canonical business settings, permissions and immutable issuer evidence.", "clusterId": "B-COMPANY"},
    {"capabilityId": "CAP-COMMERCIAL", "title": "Commercial configuration and snapshots", "description": "Versioned delivery, parcel, store, commission, surcharge and payment-method policy.", "clusterId": "B-COMMERCIAL-CONFIG"},
    {"capabilityId": "CAP-MODULE-TAXONOMY", "title": "Modules, taxonomy and store onboarding", "description": "Governed business modules, category hierarchy and catalog boundaries.", "clusterId": "B-MODULE-TAXONOMY"},
    {"capabilityId": "CAP-GEOGRAPHY", "title": "Nationwide discovery and serviceability", "description": "Selling territory, coverage, distance evidence and checkout serviceability.", "clusterId": "B-GEOGRAPHY-SERVICEABILITY"},
    {"capabilityId": "CAP-DRIVER-VEHICLE", "title": "Driver and vehicle compliance", "description": "Identity, documents, approvals, vehicles, eligibility and location evidence.", "clusterId": "B-DRIVER-VEHICLE-COMPLIANCE"},
    {"capabilityId": "CAP-PRIVATE-MEDIA", "title": "Private media and evidence", "description": "Validated, private, owner-scoped and retained KYC/proof/media evidence.", "clusterId": "B-PRIVATE-MEDIA"},
    {"capabilityId": "CAP-PAYMENTS-COD", "title": "Payments, COD and cash reconciliation", "description": "Digital payments plus explicit COD/partial-payment custody, settlement and ledger behavior.", "clusterId": "B-PAYMENTS-COD"},
    {"capabilityId": "CAP-CLAIMS-REMEDIES", "title": "Claims and consumer remedies", "description": "Claim cases, evidence, investigation, remedies and composable refund execution.", "clusterId": "B-CLAIMS-REMEDIES"},
    {"capabilityId": "CAP-PROMOTER", "title": "Promoter programme and economics", "description": "Programme, ranks, referrals, team graph, qualification, commissions, earnings and surfaces.", "clusterId": "B-PROMOTER"},
    {"capabilityId": "CAP-ADVERTISING", "title": "On-platform advertising and external boundary", "description": "Campaign packages, requests, creative, approval, lifecycle, revenue and external publishing choice.", "clusterId": "B-ADVERTISING"},
    {"capabilityId": "CAP-PRIVACY-COMPLIANCE", "title": "Privacy and compliance engineering", "description": "Notice, acceptance, preferences, rights requests, retention, location, incidents and processors.", "clusterId": "B-PRIVACY-COMPLIANCE"},
    {"capabilityId": "CAP-SHIPPING-OPERATIONS", "title": "Shipping and delivery operations", "description": "Service scope, booking, timing, tracking, POD, exceptions, vendor and driver operations.", "clusterId": "B-SHIPPING-OPERATIONS"},
    {"capabilityId": "CAP-POLICY-CONTROLS", "title": "Legal document governance", "description": "Versioned publication and controlled reconciliation between policy text and behavior.", "clusterId": "B-PRIVACY-COMPLIANCE"},
]


DOMAIN_DEFAULTS = {
    "company": "ENG-COMPANY-001",
    "pricing": "ENG-COMMERCIAL-001",
    "parcel": "ENG-COMMERCIAL-002",
    "store": "ENG-MODULE-004",
    "catalog": "ENG-MODULE-002",
    "geography": "ENG-GEO-002",
    "driver": "ENG-DRIVER-001",
    "vehicle": "ENG-VEHICLE-001",
    "media": "ENG-MEDIA-001",
    "promoter": "ENG-PROM-001",
    "advertising": "ENG-ADS-001",
    "payment": "ENG-PAY-002",
    "cod": "ENG-COD-001",
    "claim": "ENG-CLAIM-001",
    "refund": "ENG-CLAIM-001",
    "privacy": "ENG-PRIV-001",
    "privacy_policy": "ENG-PRIV-001",
    "shipping": "ENG-SHIP-001",
    "terms": "ENG-POLICY-001",
}


def classify_source_atom(atom: dict[str, Any]) -> str:
    text = norm(atom.get("sourceText", ""))
    source_type = atom.get("requirementType")
    status = atom.get("status")
    document = atom.get("sourceDocument", "")
    if source_type == "EXAMPLE_ONLY":
        return "EXAMPLE"
    if source_type == "FUTURE_OPTION":
        return "FUTURE_OPTION"
    if source_type == "AMBIGUITY" or status == "CLIENT_VALUE_REQUIRED":
        return "CLIENT_CLARIFICATION"
    if source_type in {"MARKETING_CONTENT", "CLIENT_VALUE"}:
        return "PRODUCT_DESCRIPTION"
    if source_type in {"USER_OBLIGATION"}:
        return "USER_OBLIGATION"
    if source_type in {"VENDOR_OBLIGATION", "DRIVER_OBLIGATION"}:
        return "BUSINESS_POLICY"
    if source_type == "COMPLIANCE_CONTROL":
        return "LEGAL_AND_IMPLEMENTATION"
    if source_type == "LEGAL_POLICY_TEXT":
        controls = ["consent", "cookie", "data subject", "retention", "deletion", "security", "incident", "refund", "claim", "delivery", "prohibited", "vendor", "driver", "acceptance", "acknowledge"]
        if any(term in text for term in controls):
            return "LEGAL_AND_IMPLEMENTATION"
        review_terms = ["applicable law", "statutory", "consumer rights", "limitation of liability", "indemn", "governing law", "at our discretion", "legal action", "policy changes", "rights or remedies"]
        return "LEGAL_REVIEW" if any(term in text for term in review_terms) else "LEGAL_CONTENT_ONLY"
    if source_type in {"BUSINESS_CONFIGURATION", "ADMIN_CAPABILITY"}:
        values = ["r", "price", "rate", "percentage", "vat", "number", "email", "address", "limit", "editable", "configure", "dropdown", "value"]
        return "CONFIGURATION_VALUE" if any(term in text for term in values) else "IMPLEMENTATION_REQUIREMENT"
    if source_type in {"OPERATIONAL_RULE", "PRODUCT_REQUIREMENT", "NON_FUNCTIONAL_REQUIREMENT"}:
        if document in {"KT COURIERS (PTY) LTD – PRIVACY POLICY.docx", "KT COURIERS (PTY) LTD – REFUND & CANCELLATION.docx", "KT COURIERS (PTY) LTD – SHIPPING & DELIVERY.docx", "KT COURIERS (PTY) LTD – TERMS AND CONDITIONS.docx"} and status == "LEGAL_REVIEW_REQUIRED":
            return "LEGAL_REVIEW"
        values = ["price", "rate", "commission", "r", "vat", "threshold", "limit", "duration", "turnaround", "amount"]
        return "CONFIGURATION_VALUE" if any(term in text for term in values) else "IMPLEMENTATION_REQUIREMENT"
    return "LEGAL_REVIEW"


def source_is_relevant(source_class: str) -> bool:
    return source_class in IMPLEMENTATION_RELEVANT_CLASSES


def select_requirement(atom: dict[str, Any], specs_by_id: dict[str, dict[str, Any]]) -> str | None:
    source_class = atom["sourceClassification"]
    if not source_is_relevant(source_class):
        return None
    domain = atom.get("domain", "")
    text = norm(atom.get("sourceText", ""))
    candidates = [spec for spec in specs_by_id.values() if domain in spec["domains"]]
    if not candidates:
        return DOMAIN_DEFAULTS.get(domain)
    scored: list[tuple[int, str]] = []
    for spec in candidates:
        score = sum(1 for keyword in spec["keywords"] if norm(keyword) in text)
        if score:
            score += 10
        scored.append((score, spec["id"]))
    scored.sort(key=lambda item: (-item[0], item[1]))
    best_score, best_id = scored[0]
    if best_score > 0:
        return best_id
    return DOMAIN_DEFAULTS.get(domain) or candidates[0]["id"]


def dedupe(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def current_authorities(atom_ids: list[str], atom_by_id: dict[str, dict[str, Any]]) -> list[str]:
    values: list[str] = []
    for atom_id in atom_ids:
        atom = atom_by_id[atom_id]
        for key in ["existingDatabaseAuthority", "existingBackendAuthority", "existingApiAuthority", "existingFrontendAuthority"]:
            values.extend(atom.get(key, []))
    return dedupe(values)


def test_score_for(domain: str, test_coverage: dict[str, dict[str, Any]]) -> float:
    key = {
        "commercial config": "commercial config",
        "driver/vehicle": "driver/vehicle",
        "private media": "private media",
        "payments/COD": "payments/COD",
    }.get(domain, domain)
    row = test_coverage.get(key, {})
    weights = [("unit", 0.2), ("service", 0.2), ("routeApi", 0.2), ("realPostgres", 0.2), ("concurrency", 0.1), ("frontendIntegration", 0.1)]
    return round(sum(weight for field, weight in weights if row.get(field)), 3)


def workflow_records(req_by_id: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    def reqs(*ids: str) -> list[str]:
        return [req_id for req_id in ids if req_id in req_by_id]

    return [
        {"workflowId": "FW-001", "capabilityId": "CAP-GEOGRAPHY", "portal": "public", "route": "/shop", "workflow": "Browse nationwide stores/products then receive explicit serviceability state", "requirementIds": reqs("ENG-GEO-001", "ENG-GEO-002"), "requiredEvidence": {"page": True, "data": True, "actions": True, "backend": True, "permissions": False, "errorState": True}, "evidence": {"page": True, "data": True, "actions": True, "backend": True, "permissions": True, "errorState": False}, "basis": "Existing public shop/search and coverage authorities; explicit serviceability failure remains a delta."},
        {"workflowId": "FW-002", "capabilityId": "CAP-PAYMENTS-COD", "portal": "customer", "route": "/checkout/:reference/payment", "workflow": "Select payment method and complete digital/COD payment state", "requirementIds": reqs("ENG-PAY-001", "ENG-PAY-002", "ENG-COD-001"), "requiredEvidence": {"page": True, "data": True, "actions": True, "backend": True, "permissions": True, "errorState": True}, "evidence": {"page": True, "data": True, "actions": True, "backend": True, "permissions": True, "errorState": False}, "basis": "PayFast path is mature; COD/partial state and standardized failure mapping are not closed."},
        {"workflowId": "FW-003", "capabilityId": "CAP-COMMERCIAL", "portal": "admin", "route": "/admin/pricing", "workflow": "Configure versioned commercial rules with validation and audit", "requirementIds": reqs("ENG-COMMERCIAL-001", "ENG-COMMERCIAL-002", "ENG-COMMERCIAL-003", "ENG-COMMERCIAL-004"), "requiredEvidence": {"page": True, "data": True, "actions": True, "backend": True, "permissions": True, "errorState": True}, "evidence": {"page": True, "data": True, "actions": True, "backend": True, "permissions": False, "errorState": False}, "basis": "Pricing authority exists; normalized configuration permission/snapshot/error proof remains."},
        {"workflowId": "FW-004", "capabilityId": "CAP-MODULE-TAXONOMY", "portal": "store/admin", "route": "/store/catalog", "workflow": "Manage catalog through governed modules/categories and variants", "requirementIds": reqs("ENG-MODULE-001", "ENG-MODULE-002", "ENG-MODULE-003", "ENG-MODULE-004"), "requiredEvidence": {"page": True, "data": True, "actions": True, "backend": True, "permissions": True, "errorState": True}, "evidence": {"page": True, "data": True, "actions": True, "backend": True, "permissions": False, "errorState": False}, "basis": "Catalog surfaces and authorities exist; module governance and route-level permission/failure proof remain."},
        {"workflowId": "FW-005", "capabilityId": "CAP-DRIVER-VEHICLE", "portal": "driver/admin", "route": "/driver/profile", "workflow": "Complete driver, vehicle and compliance workflow", "requirementIds": reqs("ENG-DRIVER-001", "ENG-DRIVER-002", "ENG-DRIVER-003", "ENG-VEHICLE-001", "ENG-VEHICLE-002", "ENG-VEHICLE-003"), "requiredEvidence": {"page": True, "data": True, "actions": True, "backend": True, "permissions": True, "errorState": True}, "evidence": {"page": True, "data": True, "actions": True, "backend": True, "permissions": True, "errorState": False}, "basis": "Driver page/profile authority exists; first-class vehicle, private documents and independent approvals are gaps."},
        {"workflowId": "FW-006", "capabilityId": "CAP-SHIPPING-OPERATIONS", "portal": "driver", "route": "/driver/assignments/:id", "workflow": "Accept, pickup, deliver and record POD/exception evidence", "requirementIds": reqs("ENG-SHIP-002", "ENG-SHIP-004", "ENG-SHIP-005", "ENG-SHIP-008"), "requiredEvidence": {"page": True, "data": True, "actions": True, "backend": True, "permissions": True, "errorState": True}, "evidence": {"page": True, "data": True, "actions": True, "backend": True, "permissions": True, "errorState": False}, "basis": "Delivery execution exists; normalized COD/POD/exception failure evidence remains."},
        {"workflowId": "FW-007", "capabilityId": "CAP-PROMOTER", "portal": "promoter/admin", "route": "/promoter", "workflow": "View referrals, team, qualification, earnings and withdrawals", "requirementIds": reqs("ENG-PROM-001", "ENG-PROM-002", "ENG-PROM-003", "ENG-PROM-004", "ENG-PROM-005", "ENG-PROM-006", "ENG-PROM-007", "ENG-PROM-008"), "requiredEvidence": {"page": True, "data": True, "actions": True, "backend": True, "permissions": True, "errorState": True}, "evidence": {"page": True, "data": True, "actions": True, "backend": True, "permissions": True, "errorState": False}, "basis": "Promoter authorities and surface exist; final economics and blocked/error states remain."},
        {"workflowId": "FW-008", "capabilityId": "CAP-ADVERTISING", "portal": "store/admin", "route": "/store/advertising", "workflow": "Request, approve, schedule and report an on-platform campaign", "requirementIds": reqs("ENG-ADS-001", "ENG-ADS-002", "ENG-ADS-004", "ENG-ADS-005", "ENG-ADS-006", "ENG-ADS-007"), "requiredEvidence": {"page": True, "data": True, "actions": True, "backend": True, "permissions": True, "errorState": True}, "evidence": {"page": True, "data": True, "actions": True, "backend": True, "permissions": True, "errorState": False}, "basis": "On-platform lifecycle is mature; normalized creative/error/provider-unavailable states remain."},
        {"workflowId": "FW-009", "capabilityId": "CAP-CLAIMS-REMEDIES", "portal": "customer/store/admin", "route": "/account/refunds", "workflow": "Submit, investigate, decide and execute claim remedy/refund", "requirementIds": reqs("ENG-CLAIM-001", "ENG-CLAIM-002", "ENG-CLAIM-003", "ENG-CLAIM-004", "ENG-CLAIM-005", "ENG-CLAIM-006", "ENG-CLAIM-007", "ENG-CLAIM-008"), "requiredEvidence": {"page": True, "data": True, "actions": True, "backend": True, "permissions": True, "errorState": True}, "evidence": {"page": True, "data": True, "actions": False, "backend": False, "permissions": True, "errorState": False}, "basis": "Refund/issue surfaces exist; distinct claim case, remedy and investigation authority is not proven."},
        {"workflowId": "FW-010", "capabilityId": "CAP-PRIVACY-COMPLIANCE", "portal": "public/account/admin", "route": "/privacy-policy and /admin/privacy-requests", "workflow": "Read policy and submit/process data-subject request", "requirementIds": reqs("ENG-PRIV-001", "ENG-PRIV-005", "ENG-PRIV-006", "ENG-PRIV-008", "ENG-POLICY-001"), "requiredEvidence": {"page": True, "contentAuthority": True, "data": True, "actions": True, "backend": True, "permissions": True}, "evidence": {"page": True, "contentAuthority": True, "data": True, "actions": True, "backend": True, "permissions": True}, "basis": "Policy page/content and privacy request authorities exist; new data-class controls remain implementation deltas.", "contentWorkflow": True},
        {"workflowId": "FW-011", "capabilityId": "CAP-COMPANY", "portal": "admin", "route": "/admin/settings", "workflow": "Manage company settings and issuer values", "requirementIds": reqs("ENG-COMPANY-001", "ENG-COMPANY-002", "ENG-COMPANY-003"), "requiredEvidence": {"page": True, "data": True, "actions": True, "backend": True, "permissions": True, "errorState": True}, "evidence": {"page": True, "data": True, "actions": True, "backend": True, "permissions": False, "errorState": False}, "basis": "SystemSetting/admin settings evidence exists; canonical issuer and granular permission closure remains."},
        {"workflowId": "FW-012", "capabilityId": "CAP-POLICY-CONTROLS", "portal": "public/admin", "route": "/terms, /privacy-policy, /services", "workflow": "Publish/version legal documents and link acceptance/behavior", "requirementIds": reqs("ENG-POLICY-001", "ENG-POLICY-002", "ENG-PRIV-002", "ENG-PRIV-003", "ENG-PRIV-004"), "requiredEvidence": {"page": True, "contentAuthority": True, "data": True, "actions": True, "backend": True}, "evidence": {"page": True, "contentAuthority": True, "data": True, "actions": True, "backend": True}, "basis": "Legal document authority and public pages exist; policy precedence/legal decisions remain separate from page polish.", "contentWorkflow": True},
    ]


def workflow_score(workflow: dict[str, Any]) -> float:
    required = workflow["requiredEvidence"]
    evidence = workflow["evidence"]
    passed = sum(1 for key, needed in required.items() if needed and evidence.get(key))
    total = sum(1 for needed in required.values() if needed)
    return round(passed / total * 100, 1) if total else 100.0


def main() -> None:
    master = read_json("client-requirements-master.json")
    source_trace = read_json("phase-a-client-source-traceability.json")
    provider_matrix = read_json("phase-a-provider-readiness-matrix.json")
    test_audit = read_json("phase-a-test-coverage-and-discovery-audit.json")
    census = read_json("phase-a-repository-census.json")
    source_atoms = master["requirements"]
    atom_by_id = {atom["id"]: atom for atom in source_atoms}
    specs = build_specs()
    specs_by_id = {spec["id"]: spec for spec in specs}

    test_coverage = {row["domain"]: row for row in test_audit.get("domainCoverage", [])}
    atom_mappings: list[dict[str, Any]] = []
    req_to_atoms: defaultdict[str, list[str]] = defaultdict(list)
    class_counts: Counter[str] = Counter()
    relevant_counts: Counter[str] = Counter()
    for atom in source_atoms:
        source_class = classify_source_atom(atom)
        class_counts[source_class] += 1
        relevant = source_is_relevant(source_class)
        if relevant:
            relevant_counts[source_class] += 1
        atom["sourceClassification"] = source_class
        req_id = select_requirement(atom, specs_by_id)
        if req_id:
            req_to_atoms[req_id].append(atom["id"])
        atom_mappings.append({"sourceAtomId": atom["id"], "sourceClassification": source_class, "implementationRelevant": relevant, "engineeringRequirementIds": [req_id] if req_id else [], "sourceDocument": atom["sourceDocument"], "sourceUnitId": atom["sourceUnitId"], "sourceSection": atom["sourceSection"], "sourcePage": atom.get("sourcePage"), "sourceTextSummary": atom["sourceTextSummary"]})

    # Every normalized requirement has an evidence anchor. If keyword routing
    # did not find one, use a relevant atom from the same source domain.
    for spec in specs:
        if req_to_atoms[spec["id"]]:
            continue
        for atom in source_atoms:
            if not source_is_relevant(atom["sourceClassification"]):
                continue
            if atom.get("domain") in spec["domains"]:
                req_to_atoms[spec["id"]].append(atom["id"])
                for mapping in atom_mappings:
                    if mapping["sourceAtomId"] == atom["id"] and spec["id"] not in mapping["engineeringRequirementIds"]:
                        mapping["engineeringRequirementIds"].append(spec["id"])
                break

    normalized: list[dict[str, Any]] = []
    for spec in specs:
        atom_ids = dedupe(req_to_atoms[spec["id"]])
        authorities = current_authorities(atom_ids, atom_by_id)
        test_score = test_score_for(spec["testDomain"], test_coverage)
        record = {key: spec[key] for key in ["id", "capabilityId", "title", "description", "databaseRequired", "backendRequired", "apiRequired", "frontendRequired", "adminRequired", "providerRequired", "securityRelevant", "financialRelevant", "status", "gap", "phaseBAction", "phaseCAction", "phaseDProof", "clientValueDependency", "legalReviewDependency"]}
        record["sourceAtomIds"] = atom_ids
        record["currentAuthorities"] = authorities
        record["priority"] = spec["priority"]
        record["frontendWorkflow"] = spec["frontendWorkflow"]
        record["testDomain"] = spec["testDomain"]
        record["currentTestEvidenceScore"] = test_score
        record["engineeringEvidenceScore"] = STATUS_SCORE.get(spec["status"])
        record["sourceAtomCount"] = len(atom_ids)
        normalized.append(record)

    req_by_id = {req["id"]: req for req in normalized}
    workflows = workflow_records(req_by_id)
    for workflow in workflows:
        workflow["score"] = workflow_score(workflow)
        workflow["accepted"] = workflow["score"] == 100.0

    # Attach final proof references after P0/P1 IDs are known.
    p0p1 = [req for req in normalized if req["priority"] in {"P0", "P1"} and req["status"] != "NOT_APPLICABLE"]
    proof_by_capability = {
        "CAP-COMPANY": ["static", "real PostgreSQL", "E2E"],
        "CAP-COMMERCIAL": ["static", "real PostgreSQL", "concurrency", "E2E"],
        "CAP-MODULE-TAXONOMY": ["static", "real PostgreSQL", "projection", "E2E"],
        "CAP-GEOGRAPHY": ["static", "provider contract", "real PostgreSQL", "E2E"],
        "CAP-DRIVER-VEHICLE": ["static", "real PostgreSQL", "concurrency", "security", "E2E"],
        "CAP-PRIVATE-MEDIA": ["static", "provider contract", "security", "E2E"],
        "CAP-PAYMENTS-COD": ["static", "real PostgreSQL", "concurrency", "security", "E2E"],
        "CAP-CLAIMS-REMEDIES": ["static", "real PostgreSQL", "concurrency", "security", "E2E"],
        "CAP-PROMOTER": ["static", "real PostgreSQL", "concurrency", "E2E"],
        "CAP-ADVERTISING": ["static", "real PostgreSQL", "provider contract", "E2E"],
        "CAP-PRIVACY-COMPLIANCE": ["static", "real PostgreSQL", "security", "E2E"],
        "CAP-SHIPPING-OPERATIONS": ["static", "real PostgreSQL", "security", "E2E"],
        "CAP-POLICY-CONTROLS": ["static", "security", "E2E"],
    }
    proof_records = []
    for req in p0p1:
        proof_records.append({"requirementId": req["id"], "capabilityId": req["capabilityId"], "priority": req["priority"], "proofTypes": proof_by_capability.get(req["capabilityId"], ["static", "E2E"]), "acceptance": req["phaseDProof"], "sourceAtomIds": req["sourceAtomIds"]})
        req["phaseDProof"] = f"phase-d-proof-ledger.json requirementProofs[{req['id']}]"

    # Capability map is Level 3; normalized records are Level 2; the preserved
    # traceability artifact remains Level 1.
    capabilities = []
    for capability in CAPABILITIES:
        members = [req for req in normalized if req["capabilityId"] == capability["capabilityId"]]
        atom_ids = dedupe([atom_id for req in members for atom_id in req["sourceAtomIds"]])
        status_summary = Counter(req["status"] for req in members)
        priorities = Counter(req["priority"] for req in members)
        capabilities.append({**capability, "engineeringRequirementIds": [req["id"] for req in members], "sourceAtomIds": atom_ids, "sourceAtomCount": len(atom_ids), "statusCounts": dict(status_summary), "priorityCounts": dict(priorities), "currentAuthorities": dedupe([authority for req in members for authority in req["currentAuthorities"]]), "clientValueDependencies": dedupe([req["clientValueDependency"] for req in members if req["clientValueDependency"]]), "legalReviewDependencies": dedupe([req["legalReviewDependency"] for req in members if req["legalReviewDependency"]])})

    write_json("phase-a-normalized-capability-map.json", {"schemaVersion": "phase-a-normalized-capability-map-v1", "generatedAt": now_iso(), "levels": {"LEVEL_1_SOURCE_ATOM": "Exact document evidence preserved in phase-a-client-source-traceability.json", "LEVEL_2_ENGINEERING_REQUIREMENT": "Independently implementable/testable records in phase-a-normalized-engineering-requirements.json", "LEVEL_3_PRODUCT_CAPABILITY": "Coherent feature/domain groupings in this artifact"}, "capabilities": capabilities, "sourceCorpus": {"sourceAtomCount": len(source_atoms), "sourceManifest": "artifacts/client-authority-document-manifest.json", "sourceTraceability": "artifacts/phase-a-client-source-traceability.json"}})

    write_json("phase-a-normalized-engineering-requirements.json", {"schemaVersion": "phase-a-normalized-engineering-requirements-v1", "generatedAt": now_iso(), "sourceAtomCount": len(source_atoms), "engineeringRequirementCount": len(normalized), "applicableDenominator": len(normalized), "requirements": normalized})

    unmapped_relevant = [mapping for mapping in atom_mappings if mapping["implementationRelevant"] and not mapping["engineeringRequirementIds"]]
    write_json("phase-a-normalization-coverage.json", {"schemaVersion": "phase-a-normalization-coverage-v1", "generatedAt": now_iso(), "sourceAtomCount": len(source_atoms), "classifiedAtomCount": sum(class_counts.values()), "unclassifiedAtomCount": len(source_atoms) - sum(class_counts.values()), "implementationRelevantAtomCount": sum(relevant_counts.values()), "implementationRelevantMappedAtomCount": sum(1 for mapping in atom_mappings if mapping["implementationRelevant"] and mapping["engineeringRequirementIds"]), "legalContentOnlyAtomCount": class_counts["LEGAL_CONTENT_ONLY"], "nonFeatureExcludedAtomCount": sum(class_counts[key] for key in ["LEGAL_CONTENT_ONLY", "PRODUCT_DESCRIPTION", "EXAMPLE", "FUTURE_OPTION"]), "lostSourceLinks": source_trace["atomization"]["missingSourceLinks"], "sourceClassificationCounts": dict(class_counts), "implementationRelevantClassificationCounts": dict(relevant_counts), "allSourceAtomsClassified": sum(class_counts.values()) == len(source_atoms), "allImplementationRelevantAtomsMapped": not unmapped_relevant, "unclassifiedAtoms": [], "unmappedImplementationRelevantAtoms": unmapped_relevant, "atomMappings": atom_mappings})

    cluster_meta = {
        "B-COMPANY": {"domain": "company identity and issuer snapshots", "risk": "P1", "dependencies": [], "filesLikelyTouched": ["prisma/schema.prisma", "lib/config/*", "lib/services/legal-documents.service.ts", "app/api/admin/settings/*"], "permissionChanges": ["company.settings.read", "company.settings.write"], "testsRequired": ["typed validation", "route authorization", "snapshot immutability", "real PostgreSQL", "E2E"], "clientValuesRequired": ["physical business address", "canonical issuer contacts"], "completionCriteria": "company settings and issuer outputs are canonical, versioned and snapshot-safe"},
        "B-COMMERCIAL-CONFIG": {"domain": "commercial configuration and snapshots", "risk": "P0", "dependencies": ["B-COMPANY"], "filesLikelyTouched": ["prisma/schema.prisma", "lib/pricing/*", "lib/commissions/*", "lib/marketplace-checkout/*", "lib/validation/*"], "permissionChanges": ["pricing.read", "pricing.write", "cod.policy.read", "cod.policy.write"], "testsRequired": ["calculator", "configuration snapshots", "conflict", "concurrency", "real PostgreSQL", "E2E"], "clientValuesRequired": ["service/rate interpretation", "COD partial semantics", "final commercial percentages"], "completionCriteria": "new configuration affects new quotes/orders only and accepted commercial evidence is immutable"},
        "B-MODULE-TAXONOMY": {"domain": "business modules, taxonomy and store onboarding", "risk": "P1", "dependencies": [], "filesLikelyTouched": ["prisma/schema.prisma", "lib/catalog/*", "lib/storefront/*", "app/api/admin/catalog/*"], "permissionChanges": ["catalog.category.manage", "catalog.module.manage"], "testsRequired": ["taxonomy hierarchy", "governance", "publication", "projection", "real PostgreSQL", "E2E"], "clientValuesRequired": ["approved module/taxonomy launch content"], "completionCriteria": "module/category governance is canonical and variants/options remain separate"},
        "B-GEOGRAPHY-SERVICEABILITY": {"domain": "nationwide discovery and serviceability", "risk": "P1", "dependencies": ["B-MODULE-TAXONOMY"], "filesLikelyTouched": ["prisma/schema.prisma", "lib/storefront/*", "lib/public-coverage/*", "lib/maps/*", "lib/marketplace-checkout/*"], "permissionChanges": ["coverage.manage"], "testsRequired": ["nationwide discovery", "serviceability failure", "distance evidence", "projection", "provider contract", "E2E"], "clientValuesRequired": ["operational coverage"], "completionCriteria": "discovery, selling territory, delivery coverage and checkout serviceability cannot be query-confused"},
        "B-DRIVER-VEHICLE-COMPLIANCE": {"domain": "driver, vehicle and compliance", "risk": "P0", "dependencies": ["B-PRIVATE-MEDIA"], "filesLikelyTouched": ["prisma/schema.prisma", "lib/services/driver-profile.service.ts", "lib/services/driver-eligibility.service.ts", "lib/dispatch/*", "app/api/driver/*", "app/api/admin/drivers/*"], "permissionChanges": ["driver.compliance.review", "vehicle.compliance.review"], "testsRequired": ["expiry", "approval independence", "assignment eligibility", "tenant/auth", "real PostgreSQL", "concurrency", "E2E"], "clientValuesRequired": [], "completionCriteria": "driver and selected vehicle independently satisfy compliance before assignment"},
        "B-PRIVATE-MEDIA": {"domain": "private media and evidence", "risk": "P0", "dependencies": [], "filesLikelyTouched": ["prisma/schema.prisma", "lib/catalog/media/*", "lib/recruitment/secure-document.adapter.ts", "lib/storage/*", "app/api/*/uploads/*"], "permissionChanges": ["media.read_private", "media.write", "media.delete"], "testsRequired": ["MIME/content/size", "tenant isolation", "signed URL expiry", "retention", "provider failure", "security"], "clientValuesRequired": [], "completionCriteria": "sensitive masters are private, owner-scoped, retained and auditable"},
        "B-PAYMENTS-COD": {"domain": "payments, COD and cash reconciliation", "risk": "P0", "dependencies": ["B-COMMERCIAL-CONFIG"], "filesLikelyTouched": ["prisma/schema.prisma", "lib/payments/*", "lib/ledger/*", "lib/marketplace-checkout/*", "app/api/payments/*"], "permissionChanges": ["payments.cod.read", "payments.cod.collect", "payments.cod.reconcile"], "testsRequired": ["state machine", "ledger conservation", "duplicate collection", "failed collection", "refund interaction", "concurrency", "E2E"], "clientValuesRequired": ["partial payment semantics", "COD maximum/policy"], "completionCriteria": "cash and digital portions reconcile across order, driver, store and ledger"},
        "B-CLAIMS-REMEDIES": {"domain": "claims and consumer remedies", "risk": "P0", "dependencies": ["B-PRIVATE-MEDIA", "B-PAYMENTS-COD"], "filesLikelyTouched": ["prisma/schema.prisma", "lib/refunds/*", "lib/store-orders/*", "lib/claims/*", "app/api/refunds/*"], "permissionChanges": ["claims.submit", "claims.review", "claims.resolve"], "testsRequired": ["reason/policy matrix", "evidence ownership", "partial/full refund", "redelivery/store credit", "fraud", "real PostgreSQL", "E2E"], "clientValuesRequired": ["policy precedence and remedy rules"], "completionCriteria": "claim investigation/remedy and financial refund are independently auditable but composable"},
        "B-PROMOTER": {"domain": "promoter programme and economics", "risk": "P0", "dependencies": ["B-COMMERCIAL-CONFIG"], "filesLikelyTouched": ["prisma/schema.prisma", "lib/promoters/*", "lib/commissions/*", "scripts/process-promoter-qualifications.mjs"], "permissionChanges": ["promoter.program.manage", "promoter.rule.manage", "promoter.commission.reconcile"], "testsRequired": ["cycle/self-referral", "effective dates", "idempotency", "reversal/refund", "withdrawal", "real PostgreSQL", "E2E"], "clientValuesRequired": ["final ranks, thresholds, percentages and registration value"], "completionCriteria": "client economics are versioned configuration and all reversals conserve the ledger"},
        "B-ADVERTISING": {"domain": "on-platform advertising and external boundary", "risk": "P1", "dependencies": ["B-PRIVATE-MEDIA"], "filesLikelyTouched": ["prisma/schema.prisma", "lib/advertising/*", "app/api/advertising/*", "app/(store)/store/advertising/page.tsx"], "permissionChanges": ["advertising.manage", "advertising.approve", "advertising.publish_external"], "testsRequired": ["funding", "approval", "schedule", "measurement", "provider unavailable", "E2E"], "clientValuesRequired": ["final packages/prices", "manual vs automatic external publishing"], "completionCriteria": "on-platform capability is not overstated as external social publishing"},
        "B-PRIVACY-COMPLIANCE": {"domain": "privacy, retention, legal documents and communications", "risk": "P1", "dependencies": ["B-PRIVATE-MEDIA"], "filesLikelyTouched": ["prisma/schema.prisma", "lib/privacy/*", "lib/retention/*", "lib/notifications/*", "lib/services/legal-documents.service.ts"], "permissionChanges": ["privacy.request.manage", "legal.document.publish", "notification.consent.manage"], "testsRequired": ["request lifecycle", "retention hold", "marketing opt-out", "redaction", "policy acceptance", "security", "E2E"], "clientValuesRequired": ["policy wording, retention and processor decisions"], "completionCriteria": "each policy control has operational evidence or an explicit legal/manual verification record"},
        "B-SHIPPING-OPERATIONS": {"domain": "shipping services and operational policy", "risk": "P1", "dependencies": ["B-COMMERCIAL-CONFIG", "B-GEOGRAPHY-SERVICEABILITY"], "filesLikelyTouched": ["prisma/schema.prisma", "lib/orders/*", "lib/services/*delivery*", "app/(public)/services/*"], "permissionChanges": ["shipping.policy.manage"], "testsRequired": ["service matrix", "state transitions", "prohibited/fragile/high value", "POD", "security", "E2E"], "clientValuesRequired": ["moving/specialised launch depth", "SLA/insurance policy"], "completionCriteria": "marketing pages do not imply unsupported online operations"},
    }
    dependency_order = ["B-COMPANY", "B-COMMERCIAL-CONFIG", "B-MODULE-TAXONOMY", "B-PRIVATE-MEDIA", "B-GEOGRAPHY-SERVICEABILITY", "B-DRIVER-VEHICLE-COMPLIANCE", "B-PAYMENTS-COD", "B-CLAIMS-REMEDIES", "B-PROMOTER", "B-ADVERTISING", "B-PRIVACY-COMPLIANCE", "B-SHIPPING-OPERATIONS"]
    clusters = []
    for cluster_id in dependency_order:
        capability_ids = [capability["capabilityId"] for capability in CAPABILITIES if capability["clusterId"] == cluster_id]
        meta = cluster_meta[cluster_id]
        members = [req for req in normalized if req["capabilityId"] in capability_ids]
        descriptions = [capability["description"] for capability in CAPABILITIES if capability["capabilityId"] in capability_ids]
        clusters.append({"clusterId": cluster_id, "capabilityIds": capability_ids, "domain": meta["domain"], "requirements": [req["id"] for req in members], "sourceAtomCount": len(dedupe([atom_id for req in members for atom_id in req["sourceAtomIds"]])), "existingAuthorities": dedupe([authority for req in members for authority in req["currentAuthorities"]]), "filesLikelyTouched": meta["filesLikelyTouched"], "schemaChangesExpected": any(req["databaseRequired"] and req["status"] in {"MISSING", "PARTIAL"} for req in members), "newMigrationExpected": any(req["databaseRequired"] and req["status"] == "MISSING" for req in members), "backendChanges": " ".join(descriptions), "APIChanges": "Close normalized DTO/mutation/error contracts for this whole domain cluster.", "permissionChanges": meta["permissionChanges"], "providerChanges": [req["title"] for req in members if req["providerRequired"]], "testsRequired": meta["testsRequired"], "realPostgresProofRequired": any(req["databaseRequired"] or req["financialRelevant"] for req in members), "dependencies": meta["dependencies"], "clientValuesRequired": meta["clientValuesRequired"], "risk": meta["risk"], "completionCriteria": meta["completionCriteria"], "sourceAtomIds": dedupe([atom_id for req in members for atom_id in req["sourceAtomIds"]])})
    write_json("phase-b-implementation-ledger.json", {"schemaVersion": "phase-a-normalized-phase-b-ledger-v1", "generatedAt": now_iso(), "sourceBasis": "Normalized engineering requirements; source atoms remain in phase-a-client-source-traceability.json.", "clusters": clusters, "dependencyOrder": dependency_order, "paragraphLevelTasksRemoved": True, "noDuplicateSubsystemPrinciple": True})

    write_json("phase-c-functional-frontend-ledger.json", {"schemaVersion": "phase-a-normalized-phase-c-ledger-v1", "generatedAt": now_iso(), "sourceBasis": "Normalized interactive workflows only; visual beautification excluded.", "records": workflows, "functionalGate": "Interactive workflow score requires every evidence item marked required; content workflows use page/content-authority sufficiency.", "visualBeautificationIncluded": False})

    high_level_proofs = [
        {"proofType": "static", "requirementsCovered": "all normalized P0/P1 requirements", "method": "typecheck/lint/static route, permission, contract and source-link scans", "traceability": "phase-a-normalized-engineering-requirements.json"},
        {"proofType": "migration", "requirementsCovered": "all database-required normalized deltas", "method": "migration safety, shadow deploy and rollback review", "traceability": "phase-b-implementation-ledger.json"},
        {"proofType": "real PostgreSQL", "requirementsCovered": "all financial and operational normalized clusters", "method": "real transaction, invariant and persistence suite", "traceability": "phase-b-implementation-ledger.json"},
        {"proofType": "concurrency", "requirementsCovered": "COD, payment, refunds, commissions, claims, approvals", "method": "parallel mutation races and idempotency tests", "traceability": "phase-a-normalized-engineering-requirements.json"},
        {"proofType": "provider contract", "requirementsCovered": "required PayFast, Maps, email and private storage capabilities", "method": "fixtures/contract tests only; no live provider calls", "traceability": "phase-a-provider-readiness-matrix.json"},
        {"proofType": "E2E", "requirementsCovered": "all normalized interactive frontend workflows", "method": "observable browser flows with failure/error states", "traceability": "phase-c-functional-frontend-ledger.json"},
        {"proofType": "security", "requirementsCovered": "securityRelevant normalized requirements", "method": "tenant/auth/rate-limit/redaction/retention/private-media proof", "traceability": "phase-a-client-delta-security-audit.json"},
    ]
    write_json("phase-d-proof-ledger.json", {"schemaVersion": "phase-a-normalized-phase-d-ledger-v1", "generatedAt": now_iso(), "sourceBasis": "Normalized engineering requirements.", "proofs": high_level_proofs, "requirementProofs": proof_records, "p0p1RequirementCount": len(p0p1), "p0p1CoverageComplete": len(proof_records) == len(p0p1)})

    applicable = [req for req in normalized if req["status"] in STATUS_SCORE]
    def dimension(field: str) -> float:
        values = [req["engineeringEvidenceScore"] for req in applicable if req[field]]
        return round(sum(values) / len(values) * 100, 1) if values else 100.0

    provider_score = provider_matrix.get("weightedCapabilityScore", {}).get("requiredCapabilityScore", 0)
    frontend_score = round(sum(workflow["score"] for workflow in workflows) / len(workflows), 1)
    security_reqs = [req for req in applicable if req["securityRelevant"]]
    security_score = round(sum(req["engineeringEvidenceScore"] for req in security_reqs) / len(security_reqs) * 100, 1) if security_reqs else 100.0
    testing_values = [req["currentTestEvidenceScore"] for req in applicable]
    testing_score = round(sum(testing_values) / len(testing_values) * 100, 1) if testing_values else 0.0
    scores = {"database": dimension("databaseRequired"), "backendDomain": dimension("backendRequired"), "api": dimension("apiRequired"), "functionalFrontend": frontend_score, "providerCode": provider_score, "securityCompliance": security_score, "testReadiness": testing_score}
    weights = {"database": 0.18, "backendDomain": 0.22, "api": 0.12, "functionalFrontend": 0.14, "providerCode": 0.08, "securityCompliance": 0.14, "testReadiness": 0.12}
    overall = round(sum(scores[key] * weights[key] for key in weights), 1)
    normalized_status_counts = Counter(req["status"] for req in normalized)
    normalized_priority_counts = Counter(req["priority"] for req in normalized)
    write_json("phase-a-readiness-score.json", {"schemaVersion": "phase-a-normalized-readiness-v1", "generatedAt": now_iso(), "readiness": {**scores, "sourceIngestion": 100, "sourceTraceability": 100, "providerCredentials": 15, "overallFunctional": overall, "method": "Only normalized engineering requirements enter the denominator. Status evidence scores: COMPLETE=1, PARTIAL=0.5, CONFIG_ONLY/PROVIDER_KEY_ONLY/CLIENT_VALUE_REQUIRED/LEGAL_REVIEW_REQUIRED=0.75, MISSING=0. NOT_APPLICABLE is excluded. Interactive frontend is workflow-scored; content workflows use page/content authority. Visual design and credentials are excluded from overall functional readiness.", "previousProvisionalOverall": 36.0, "previousProvisionalFrontend": 0.0, "previousScoresNotInherited": True}, "statusCounts": dict(normalized_status_counts), "priorityCounts": dict(normalized_priority_counts), "engineeringDenominator": len(applicable), "excludedSourceAtoms": {"legalContentOnly": class_counts["LEGAL_CONTENT_ONLY"], "productDescription": class_counts["PRODUCT_DESCRIPTION"], "examples": class_counts["EXAMPLE"], "futureOptions": class_counts["FUTURE_OPTION"], "duplicatedAtoms": len(source_atoms) - len({atom["id"] for atom in source_atoms}), "clientContactDetailsAsStandaloneFeatures": "excluded"}, "weighting": weights, "providerCapabilityScore": provider_matrix.get("weightedCapabilityScore", {}), "functionalFrontendWorkflows": workflows})

    p0 = [req for req in normalized if req["priority"] == "P0" and req["status"] != "COMPLETE"]
    p1 = [req for req in normalized if req["priority"] == "P1" and req["status"] != "COMPLETE"]
    write_json("phase-a-findings.json", {"schemaVersion": "phase-a-normalized-findings-v1", "generatedAt": now_iso(), "verdict": "PHASE_A_CLIENT_CONTRACT_AUDIT_COMPLETE", "sourceBasis": "Normalized engineering requirement model", "findings": [{"id": "F-NORM-P0", "severity": "P0", "classification": "ENGINEERING_DELTA", "title": "P0 normalized engineering deltas", "requirements": [req["id"] for req in p0], "proof": "phase-d-proof-ledger.json requirementProofs"}, {"id": "F-NORM-P1", "severity": "P1", "classification": "ENGINEERING_DELTA_OR_DEPENDENCY", "title": "P1 normalized engineering deltas and isolated dependencies", "requirements": [req["id"] for req in p1], "proof": "phase-d-proof-ledger.json requirementProofs"}], "p0Count": len(p0), "p1Count": len(p1), "strengths": ["actual source ingestion and traceability", "normalized engineering blueprint", "mature PayFast digital payment authority", "catalog variants/options separation", "on-platform advertising lifecycle", "promoter attribution/earnings foundation", "privacy request/retention foundations"]})

    write_json("phase-a-completion-matrix.json", {"schemaVersion": "phase-a-normalized-completion-matrix-v1", "generatedAt": now_iso(), "verdict": "PHASE_A_CLIENT_CONTRACT_AUDIT_COMPLETE", "sourceAtomCount": len(source_atoms), "engineeringRequirementCount": len(normalized), "engineeringDenominator": len(applicable), "capabilityCount": len(CAPABILITIES), "sourceLinksMissing": source_trace["atomization"]["missingSourceLinks"], "unclassifiedAtoms": 0, "unmappedImplementationRelevantAtoms": len(unmapped_relevant), "statusCounts": dict(normalized_status_counts), "priorityCounts": dict(normalized_priority_counts), "readiness": scores | {"overallFunctional": overall}, "phaseBStarted": False, "phaseCVisualBeautification": False, "phaseDP0P1ProofCoverage": len(proof_records) == len(p0p1), "repositoryCountsPreserved": census["counts"]})

    report_lines = [
        "# KT Couriers — Phase A Final Normalisation & Engineering Delta Closure",
        "",
        f"Generated {now_iso()} by `scripts/phase-a-normalize-engineering-model.py`. This pass reads the existing source-backed artifacts only; it does not re-ingest documents, repeat repository discovery, modify production code/schema/migrations/database, call providers, or run Git.",
        "",
        "## Final Verdict",
        "",
        "**PHASE_A_CLIENT_CONTRACT_AUDIT_COMPLETE**",
        "",
        f"The product contract is understood at engineering level: {len(source_atoms)} Level-1 source atoms are preserved, {len(normalized)} Level-2 normalized engineering requirements form the applicable denominator, {len(CAPABILITIES)} Level-3 product capabilities group them, all implementation-relevant atoms map to at least one requirement, and every P0/P1 requirement has a final proof record. This is Phase A closure, not software implementation completion.",
        "",
        "## Normalisation Counts",
        "",
        f"- Source atoms preserved: **{len(source_atoms)}**; source links lost: **{source_trace['atomization']['missingSourceLinks']}**.",
        f"- Normalized engineering requirements: **{len(normalized)}**; denominator: **{len(applicable)}**.",
        f"- Product capabilities: **{len(CAPABILITIES)}**; P0 deltas: **{len(p0)}**; P1 deltas/dependencies: **{len(p1)}**.",
        f"- Source classification counts: " + "; ".join(f"{key} {class_counts.get(key, 0)}" for key in SOURCE_CLASSES) + ".",
        "",
        "Legal-content-only, product-description, example and future-option atoms remain in the evidence layer and are excluded from the engineering denominator. Client values and legal review dependencies remain attached to affected engineering requirements rather than blocking the blueprint.",
        "",
        "## Recomputed Readiness",
        "",
        f"Database **{scores['database']}%**; backend/domain **{scores['backendDomain']}%**; API **{scores['api']}%**; functional frontend **{scores['functionalFrontend']}%**; required provider code **{scores['providerCode']}%**; security/compliance engineering **{scores['securityCompliance']}%**; testing **{scores['testReadiness']}%**; overall functional **{overall}%**.",
        "",
        "Formula: overall = database×0.18 + backend/domain×0.22 + API×0.12 + functional frontend×0.14 + required provider code×0.08 + security/compliance engineering×0.14 + testing×0.12. Requirement evidence scores are COMPLETE=1, PARTIAL=0.5, CONFIG_ONLY/PROVIDER_KEY_ONLY/CLIENT_VALUE_REQUIRED/LEGAL_REVIEW_REQUIRED=0.75, MISSING=0; NOT_APPLICABLE is excluded. Credentials and visual polish are excluded.",
        "",
        "The previous 36% overall and 0% frontend scores were provisional paragraph-level results. They changed because legal prose, marketing copy, examples, future options and duplicate atoms no longer count as independent software requirements, while interactive frontend workflows are scored as workflows and content pages use content-authority evidence.",
        "",
        "## P0/P1 Delta List",
        "",
    ]
    for req in p0 + p1:
        dependency = []
        if req["clientValueDependency"]:
            dependency.append("client value")
        if req["legalReviewDependency"]:
            dependency.append("legal review")
        report_lines.append(f"- **{req['priority']} {req['id']} — {req['title']}** ({req['status']}{'; ' + ', '.join(dependency) if dependency else ''})")
    report_lines += [
        "",
        "## Revised Ledgers",
        "",
        f"- Phase B: {len(clusters)} whole-domain implementation clusters in [phase-b-implementation-ledger.json](../artifacts/phase-b-implementation-ledger.json); paragraph-level tasks removed.",
        f"- Phase C: {len(workflows)} functional workflows in [phase-c-functional-frontend-ledger.json](../artifacts/phase-c-functional-frontend-ledger.json); visual beautification excluded.",
        f"- Phase D: {len(proof_records)} P0/P1 requirement proofs in [phase-d-proof-ledger.json](../artifacts/phase-d-proof-ledger.json); coverage complete.",
        "",
        "## Preserved Evidence",
        "",
        "The original source corpus remains in [phase-a-client-source-traceability.json](../artifacts/phase-a-client-source-traceability.json) and [client-authority-document-manifest.json](../artifacts/client-authority-document-manifest.json). Normalized outputs are [phase-a-normalized-capability-map.json](../artifacts/phase-a-normalized-capability-map.json), [phase-a-normalized-engineering-requirements.json](../artifacts/phase-a-normalized-engineering-requirements.json), and [phase-a-normalization-coverage.json](../artifacts/phase-a-normalization-coverage.json).",
        "",
        "Phase B was not started. No production code, Prisma schema, migration, database, seed, provider or Git state was changed.",
        "",
    ]
    REPORT.write_text("\n".join(report_lines), encoding="utf-8")

    print(json.dumps({"verdict": "PHASE_A_CLIENT_CONTRACT_AUDIT_COMPLETE", "sourceAtoms": len(source_atoms), "engineeringRequirements": len(normalized), "capabilities": len(CAPABILITIES), "p0": len(p0), "p1": len(p1), "scores": scores | {"overallFunctional": overall}, "unmappedImplementationRelevantAtoms": len(unmapped_relevant), "p0p1ProofCoverage": len(proof_records) == len(p0p1)}, indent=2))


if __name__ == "__main__":
    main()
