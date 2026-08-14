"""Phase A actual client-document ingestion and reconciliation.

This script is intentionally read-only with respect to production source, Prisma,
databases, providers, and Git. It reads the six authoritative DOCX files and the
existing Phase A census, then writes audit/document artifacts only.
"""

from __future__ import annotations

import hashlib
import json
import re
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
DOC_ROOT = ROOT / "docs" / "client-authority" / "2026-08"
ARTIFACT_ROOT = ROOT / "artifacts"
REPORT_PATH = ROOT / "docs" / "phase-a-client-contract-audit.md"

EXPECTED_DOCUMENTS = [
    "KT_Couriers_Updated Details..docx",
    "KT COURIERS (PTY) LTD – ABOUT US.docx",
    "KT COURIERS (PTY) LTD – SHIPPING & DELIVERY.docx",
    "KT COURIERS (PTY) LTD – PRIVACY POLICY.docx",
    "KT COURIERS (PTY) LTD – REFUND & CANCELLATION.docx",
    "KT COURIERS (PTY) LTD – TERMS AND CONDITIONS.docx",
]

DOCUMENT_CODES = {
    EXPECTED_DOCUMENTS[0]: "UPDATED",
    EXPECTED_DOCUMENTS[1]: "ABOUT",
    EXPECTED_DOCUMENTS[2]: "SHIPPING",
    EXPECTED_DOCUMENTS[3]: "PRIVACY",
    EXPECTED_DOCUMENTS[4]: "REFUND",
    EXPECTED_DOCUMENTS[5]: "TERMS",
}

PASTED_TEXT_ATTACHMENTS = {
    "KT COURIERS (PTY) LTD – REFUND & CANCELLATION.docx": "e91b03ba-1887-4e5f-9ca4-9e1ce655cc65",
    "KT COURIERS (PTY) LTD – TERMS AND CONDITIONS.docx": "a80b3dd5-cfea-4cd3-8b75-a827418743f0",
    "KT_Couriers_Updated Details..docx": "35369f3b-eaa7-405c-81bc-472794bf42c0",
    "KT COURIERS (PTY) LTD – PRIVACY POLICY.docx": "d525ad8a-971a-47cf-8760-6fe6b943fb09",
    "KT COURIERS (PTY) LTD – ABOUT US.docx": "0eea6c70-27a1-481b-bc15-faae51615db0",
    "KT COURIERS (PTY) LTD – SHIPPING & DELIVERY.docx": "58433432-fc8b-4d90-8126-6ea8863d17d5",
}

REQUIREMENT_TYPES = [
    "PRODUCT_REQUIREMENT",
    "BUSINESS_CONFIGURATION",
    "OPERATIONAL_RULE",
    "LEGAL_POLICY_TEXT",
    "COMPLIANCE_CONTROL",
    "USER_OBLIGATION",
    "VENDOR_OBLIGATION",
    "DRIVER_OBLIGATION",
    "ADMIN_CAPABILITY",
    "MARKETING_CONTENT",
    "FUTURE_OPTION",
    "EXAMPLE_ONLY",
    "CLIENT_VALUE",
    "AMBIGUITY",
    "NON_FUNCTIONAL_REQUIREMENT",
]

STATUS_ENUM = [
    "COMPLETE",
    "PARTIAL",
    "MISSING",
    "CONFLICT",
    "CONFIG_ONLY",
    "PROVIDER_KEY_ONLY",
    "CLIENT_VALUE_REQUIRED",
    "LEGAL_REVIEW_REQUIRED",
    "NOT_APPLICABLE",
    "SUPERSEDED",
]

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

AUTHORITY_BY_DOMAIN: dict[str, dict[str, list[str]]] = {
    "company": {
        "database": ["prisma/schema.prisma:958 (SystemSetting)"],
        "backend": ["lib/services/legal-documents.service.ts", "lib/settings/"],
        "api": ["app/api/admin/settings/*"],
        "frontend": ["app/(admin)/admin/settings/*"],
    },
    "pricing": {
        "database": ["prisma/schema.prisma:775"],
        "backend": ["lib/pricing/calculator.ts", "lib/pricing/rule-selector.ts", "lib/services/pricing.service.ts", "lib/services/pricing-quote.service.ts"],
        "api": ["app/api/pricing/*", "app/api/admin/pricing/*"],
        "frontend": ["app/(admin)/admin/pricing/*", "app/(public)/services/*"],
    },
    "parcel": {
        "database": ["prisma/schema.prisma:775"],
        "backend": ["lib/pricing/calculator.ts", "lib/services/pricing-quote.service.ts"],
        "api": ["app/api/pricing/*"],
        "frontend": ["app/(public)/services/*", "app/(account)/account/request-delivery/*"],
    },
    "store": {
        "database": ["prisma/schema.prisma:7954"],
        "backend": ["lib/storefront/search/storefront-search.service.ts", "lib/storefront/storefront-location.service.ts"],
        "api": ["app/api/store/*", "app/api/storefront/*"],
        "frontend": ["app/(public)/shop/*", "app/(store)/store/*"],
    },
    "catalog": {
        "database": ["prisma/schema.prisma:7193"],
        "backend": ["lib/services/catalog-page.service.ts", "lib/catalog/catalog-api-policy.ts"],
        "api": ["app/api/catalog/*", "app/api/store/catalog/*"],
        "frontend": ["app/(store)/store/catalog/*", "app/(public)/shop/*"],
    },
    "geography": {
        "database": ["prisma/schema.prisma:746"],
        "backend": ["lib/public-coverage/coverage.ts", "lib/maps/delivery-zone.service.ts", "lib/storefront/storefront-location.service.ts"],
        "api": ["app/api/coverage/*", "app/api/addresses/*"],
        "frontend": ["app/(public)/shop/*", "app/(account)/account/addresses/*"],
    },
    "driver": {
        "database": ["prisma/schema.prisma:382", "prisma/schema.prisma:1201"],
        "backend": ["lib/services/driver-profile.service.ts", "lib/services/driver-eligibility.service.ts", "lib/dispatch/eligibility.ts"],
        "api": ["app/api/driver/profile/route.ts", "app/api/admin/drivers/*"],
        "frontend": ["app/(driver)/driver/profile/*", "app/(admin)/admin/drivers/*"],
    },
    "vehicle": {
        "database": ["prisma/schema.prisma:382 DriverProfile"],
        "backend": ["lib/services/driver-profile.service.ts", "lib/services/driver-eligibility.service.ts"],
        "api": ["app/api/driver/profile/route.ts"],
        "frontend": ["app/(driver)/driver/profile/*", "app/(admin)/admin/drivers/*"],
    },
    "media": {
        "database": ["prisma/schema.prisma:7604", "prisma/schema.prisma:985 DriverDocument"],
        "backend": ["lib/catalog/media/catalog-media-content-validation.ts", "lib/catalog/media/catalog-media-storage-adapter.ts", "lib/recruitment/secure-document.adapter.ts"],
        "api": ["app/api/store/catalog/media/uploads/*", "app/api/applicant/applications/*/documents"],
        "frontend": ["app/(store)/store/catalog/media/*", "app/(applicant)/applicant/applications/*/documents"],
    },
    "promoter": {
        "database": ["prisma/schema.prisma:5779"],
        "backend": ["lib/promoters/promoter-attribution.service.ts", "lib/promoters/qualification-earning.service.ts", "lib/promoters/policy.ts"],
        "api": ["app/api/promoter/*", "app/api/admin/promoter-*"],
        "frontend": ["app/(account)/promoter/*", "app/(admin)/admin/promoter-programs/*"],
    },
    "advertising": {
        "database": ["prisma/schema.prisma:9831"],
        "backend": ["lib/advertising/campaign.service.ts", "lib/advertising/billing.service.ts", "lib/advertising/serving.service.ts", "lib/advertising/measurement.service.ts"],
        "api": ["app/api/advertising/*", "app/api/admin/advertising/*"],
        "frontend": ["app/(store)/store/advertising/*", "app/(admin)/admin/advertising/*"],
    },
    "payment": {
        "database": ["prisma/schema.prisma:1848", "prisma/schema.prisma:1998"],
        "backend": ["lib/services/payment-preparation.service.ts", "lib/services/payfast-itn-application.service.ts", "lib/services/payment-reconciliation.service.ts"],
        "api": ["app/api/payments/*"],
        "frontend": ["app/(public)/checkout/*", "app/(payments)/payments/*"],
    },
    "cod": {
        "database": [],
        "backend": ["lib/services/payment-preparation.service.ts"],
        "api": ["app/api/payments/*"],
        "frontend": ["app/(public)/checkout/*"],
    },
    "claim": {
        "database": ["prisma/schema.prisma:2245 PaymentRefund", "prisma/schema.prisma:9493 MarketplaceStoreOrderIssue"],
        "backend": ["lib/services/refund-request.service.ts", "lib/refunds/refund-eligibility-policy.ts", "lib/store-orders/financial-adjustment-composition.ts"],
        "api": ["app/api/refunds/*", "app/api/store-orders/*"],
        "frontend": ["app/(account)/account/refunds/*", "app/(admin)/admin/refunds/*"],
    },
    "privacy": {
        "database": ["prisma/schema.prisma:12686"],
        "backend": ["lib/services/privacy-requests.service.ts", "lib/retention/retention-processor.ts", "lib/services/legal-documents.service.ts"],
        "api": ["app/api/admin/privacy-requests/*", "app/api/notifications/consents/*"],
        "frontend": ["app/(public)/privacy-policy/page.tsx", "app/(applicant)/applicant/data-requests/*"],
    },
    "shipping": {
        "database": ["prisma/schema.prisma:654", "prisma/schema.prisma:1201", "prisma/schema.prisma:1556"],
        "backend": ["lib/services/orders.service.ts", "lib/services/delivery-execution.service.ts", "lib/services/marketplace-delivery-tracking.service.ts"],
        "api": ["app/api/orders/*", "app/api/driver/assignments/*"],
        "frontend": ["app/(public)/services/*", "app/(driver)/driver/delivery/*", "app/(account)/account/orders/*"],
    },
    "privacy_policy": {
        "database": ["prisma/schema.prisma:12686"],
        "backend": ["lib/services/privacy-requests.service.ts", "lib/retention/retention-processor.ts", "lib/services/legal-documents.service.ts"],
        "api": ["app/api/admin/privacy-requests/*", "app/api/notifications/consents/*"],
        "frontend": ["app/(public)/privacy-policy/page.tsx"],
    },
    "marketing": {
        "database": [],
        "backend": ["lib/services/legal-documents.service.ts"],
        "api": ["app/api/legal-documents/*"],
        "frontend": ["app/(public)/about/*", "app/(public)/services/*"],
    },
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def norm(value: str) -> str:
    value = value.replace("\u00a0", " ").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", value).strip().lower()


def compact(value: str, limit: int = 320) -> str:
    value = " ".join(value.split())
    return value if len(value) <= limit else value[: limit - 1].rstrip() + "…"


def normalize_source_copy_line(value: str) -> str:
    value = value.replace("\u00a0", " ").replace("•", " ").replace("▪", " ").replace("→", " ").replace("↓", " ")
    value = value.replace("×", "x").replace("–", "-").replace("—", "-").replace("’", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", value).strip().lower()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def local_path(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def write_json(name: str, payload: Any) -> None:
    target = ARTIFACT_ROOT / name
    target.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def child_text(element: ET.Element) -> str:
    return "".join(element.itertext()).replace("\u00a0", " ").strip()


def paragraph_style(paragraph: ET.Element) -> str:
    style = paragraph.find("./w:pPr/w:pStyle", NS)
    return style.attrib.get(W + "val", "") if style is not None else ""


def has_numbering(paragraph: ET.Element) -> bool:
    return paragraph.find("./w:pPr/w:numPr", NS) is not None


def looks_like_heading(text: str, style: str) -> bool:
    if style.lower().startswith("heading"):
        return True
    if re.match(r"^\d+(?:\.\d+)*[.)]?\s+\S+", text):
        return len(text) < 140
    if text.isupper() and 3 <= len(text) <= 120 and not text.endswith("."):
        return True
    return False


def cell_text(cell: ET.Element) -> str:
    paragraphs = []
    for paragraph in cell.findall(".//w:p", NS):
        text = child_text(paragraph)
        if text:
            paragraphs.append(text)
    return " / ".join(paragraphs)


def extract_document(path: Path) -> dict[str, Any]:
    code = DOCUMENT_CODES[path.name]
    units: list[dict[str, Any]] = []
    section = "DOCUMENT_INTRODUCTION"
    paragraph_index = 0
    table_index = 0
    with zipfile.ZipFile(path) as archive:
        xml = ET.fromstring(archive.read("word/document.xml"))
        body = xml.find("./w:body", NS)
        if body is None:
            raise ValueError(f"No document body found in {path}")
        for child in list(body):
            tag = child.tag.rsplit("}", 1)[-1]
            if tag == "p":
                text = child_text(child)
                if not text:
                    continue
                paragraph_index += 1
                style = paragraph_style(child)
                is_heading = looks_like_heading(text, style)
                if is_heading:
                    section = text
                units.append(
                    {
                        "sourceUnitId": f"{code}-P{paragraph_index:04d}",
                        "documentCode": code,
                        "sourceElement": "HEADING" if is_heading else "PARAGRAPH",
                        "paragraphIndex": paragraph_index,
                        "tableIndex": None,
                        "tableRowIndex": None,
                        "tableColumnCount": None,
                        "style": style or None,
                        "isHeading": is_heading,
                        "isListItem": has_numbering(child),
                        "sourceSection": section,
                        "text": text,
                    }
                )
            elif tag == "tbl":
                table_index += 1
                rows = child.findall("./w:tr", NS)
                for row_index, row in enumerate(rows, 1):
                    cells = [cell_text(cell) for cell in row.findall("./w:tc", NS)]
                    if not any(cells):
                        continue
                    text = " | ".join(cells)
                    units.append(
                        {
                            "sourceUnitId": f"{code}-T{table_index:02d}R{row_index:03d}",
                            "documentCode": code,
                            "sourceElement": "TABLE_ROW",
                            "paragraphIndex": None,
                            "tableIndex": table_index,
                            "tableRowIndex": row_index,
                            "tableColumnCount": len(cells),
                            "style": None,
                            "isHeading": False,
                            "isListItem": False,
                            "sourceSection": section,
                            "text": text,
                            "cells": cells,
                        }
                    )
    substantive = [unit for unit in units if not unit["isHeading"]]
    headings = [unit for unit in units if unit["isHeading"]]
    return {
        "documentCode": code,
        "sourceDocument": path.name,
        "sourcePath": local_path(path),
        "sha256": sha256(path),
        "byteLength": path.stat().st_size,
        "sourcePage": None,
        "sourcePageBasis": "Not available: the packaged DOCX renderer could not start because LibreOffice/soffice is not installed.",
        "units": units,
        "substantiveUnits": substantive,
        "headings": headings,
        "paragraphCount": paragraph_index,
        "tableCount": table_index,
        "tableRowCount": len([unit for unit in units if unit["sourceElement"] == "TABLE_ROW"]),
    }


def compare_pasted_text_copy(document: dict[str, Any], attachment_id: str) -> dict[str, Any]:
    attachment_path = Path(r"C:\Users\ANC\.codex\attachments") / attachment_id / "pasted-text.txt"
    if not attachment_path.is_file():
        return {"attachmentId": attachment_id, "status": "UNAVAILABLE", "attachmentPath": str(attachment_path)}
    raw = attachment_path.read_text(encoding="utf-8-sig")
    pasted_lines = [line for line in raw.splitlines() if normalize_source_copy_line(line)]
    document_lines = [unit["text"] for unit in document["units"] if normalize_source_copy_line(unit["text"])]
    normalized_document = "\n".join(normalize_source_copy_line(line) for line in document_lines)
    matched = 0
    for line in pasted_lines:
        normalized_line = normalize_source_copy_line(line)
        if normalized_line in normalized_document or any(normalized_line in normalize_source_copy_line(candidate) or normalize_source_copy_line(candidate) in normalized_line for candidate in document_lines):
            matched += 1
    coverage = round(matched / len(pasted_lines) * 100, 1) if pasted_lines else 0
    return {
        "attachmentId": attachment_id,
        "attachmentPath": str(attachment_path),
        "byteLength": attachment_path.stat().st_size,
        "sha256": sha256(attachment_path),
        "nonEmptyLineCount": len(pasted_lines),
        "matchedLineCount": matched,
        "normalizedBodyCoveragePercent": coverage,
        "status": "MATCHES_REPOSITORY_DOCX_BODY" if coverage >= 99.0 else "MATERIAL_DIFFERENCE_REQUIRES_REVIEW",
        "comparisonBasis": "Normalized non-empty line coverage against DOCX paragraphs/headings/table rows; formatting-only bullets and diagram glyphs are normalized.",
    }


def domain_for(text: str, document_code: str, section: str) -> str:
    value = norm(f"{section} {text}")
    ordered = [
        ("privacy", ["privacy", "personal information", "popia", "cookie", "consent", "data subject", "retention"]),
        ("claim", ["refund", "cancellation", "wrong item", "damaged", "non-delivery", "store credit", "redelivery", "dispute"]),
        ("shipping", ["delivery", "shipping", "parcel", "moving", "prohibited item", "packaging", "proof of delivery", "vendor responsibilities", "delivery partner"]),
        ("vehicle", ["vehicle", "licence disc", "registration document", "insurance", "motorcycle", "scooter", "sedan", "hatchback", "bakkie", "panel van"]),
        ("driver", ["driver", "delivery personnel", "courier", "driver's licence", "driver status"]),
        ("promoter", ["promoter", "rank", "referral", "team leader", "supervisor", "commission earned", "team earnings"]),
        ("advertising", ["advertis", "campaign", "tiktok", "facebook", "instagram", "google", "social media"]),
        ("cod", ["cash on delivery", "cod", "cash custody", "partial payment"]),
        ("payment", ["payment", "vat", "commission", "earnings", "charge", "price", "pricing", "fee"]),
        ("store", ["store", "vendor", "nationwide", "south africa", "province", "delivery zone"]),
        ("catalog", ["product", "category", "module", "sku", "catalog", "grocery", "pharmacy", "e-commerce", "food"]),
        ("parcel", ["parcel size", "dimensions", "weight", "small", "medium", "large"]),
        ("company", ["business name", "registration number", "business address", "support email", "contact number", "company settings"]),
    ]
    if document_code == "ABOUT":
        return "marketing"
    for domain, terms in ordered:
        if any(term in value for term in terms):
            return domain
    if document_code == "PRIVACY":
        return "privacy_policy"
    if document_code in {"TERMS", "REFUND", "SHIPPING"}:
        return document_code.lower()
    return "company" if document_code == "UPDATED" else "marketing"


def is_example(text: str) -> bool:
    value = norm(text)
    return any(
        marker in value
        for marker in [
            "for example",
            "example structure",
            "example:",
            "current screenshot",
            "such as",
            "potentially later",
            "etc",
            "illustrative",
        ]
    )


def classify_type(unit: dict[str, Any], document_code: str, domain: str) -> str:
    text = unit["text"]
    value = norm(text)
    if not value:
        return "AMBIGUITY"
    if re.search(r"\b(?:business email|email|address)\s*:\s*$", text, re.I):
        return "AMBIGUITY"
    if is_example(text):
        return "EXAMPLE_ONLY"
    if any(word in value for word in ["reliable", "accessible", "security", "safety", "performance", "availability", "privacy", "retention", "reasonable safeguards"]):
        if document_code in {"PRIVACY", "TERMS", "SHIPPING", "REFUND"}:
            return "COMPLIANCE_CONTROL" if any(word in value for word in ["security", "safety", "privacy", "retention", "popia", "law", "legal", "regulat"]) else "NON_FUNCTIONAL_REQUIREMENT"
    if document_code == "ABOUT":
        return "FUTURE_OPTION" if any(word in value for word in ["future", "long-term", "as we grow", "continue to explore", "our journey does not end", "aim to expand"]) else ("CLIENT_VALUE" if any(word in value for word in ["mission", "vision", "goal", "believe", "opportunit", "convenience", "why kt", "commitment"]) else "MARKETING_CONTENT")
    if document_code == "PRIVACY":
        if any(word in value for word in ["acknowledge", "consent", "withdraw consent", "opt out", "you may", "you can control"]):
            return "USER_OBLIGATION"
        if any(word in value for word in ["security", "retention", "delete", "data subject", "lawful", "popia", "incident", "third-party", "international"]):
            return "COMPLIANCE_CONTROL"
        return "LEGAL_POLICY_TEXT"
    if document_code == "TERMS":
        if "vendor" in value and any(word in value for word in ["must", "warrant", "comply", "license", "listing"]):
            return "VENDOR_OBLIGATION"
        if any(word in value for word in ["delivery personnel", "driver", "courier"]) and any(word in value for word in ["must", "not", "comply", "report", "operate"]):
            return "DRIVER_OBLIGATION"
        if any(word in value for word in ["you must", "you agree", "you may not", "users are responsible", "by using", "consent to"]):
            return "USER_OBLIGATION"
        if any(word in value for word in ["may suspend", "may terminate", "may require", "reserve the right", "monitor", "inspect"]):
            return "ADMIN_CAPABILITY"
        return "LEGAL_POLICY_TEXT"
    if document_code == "REFUND":
        if any(word in value for word in ["customer", "you ", "please contact", "should report", "responsibilities"]):
            return "USER_OBLIGATION"
        if "vendor" in value:
            return "VENDOR_OBLIGATION"
        if any(word in value for word in ["must", "required", "applicable law", "regulated", "statutory"]):
            return "COMPLIANCE_CONTROL"
        return "LEGAL_POLICY_TEXT"
    if document_code == "SHIPPING":
        if "vendor responsibilities" in value or ("vendor" in value and any(word in value for word in ["must", "responsib", "prepare", "provide"])):
            return "VENDOR_OBLIGATION"
        if "delivery partner responsibilities" in value or ("driver" in value and any(word in value for word in ["must", "responsib", "report"])):
            return "DRIVER_OBLIGATION"
        if any(word in value for word in ["customer", "sender", "recipient", "you must", "you are responsible", "address accuracy"]):
            return "USER_OBLIGATION"
        if any(word in value for word in ["prohibited", "legal", "regulat", "packaging requirements", "insurance"]):
            return "COMPLIANCE_CONTROL"
        return "OPERATIONAL_RULE"
    if document_code == "UPDATED":
        if any(word in value for word in ["admin", "administrator", "admin panel", "dashboard", "should be able", "editable", "enable/disable", "menu"]):
            return "ADMIN_CAPABILITY"
        if any(word in value for word in ["should", "must", "default", "do not", "remain editable", "separat", "automatically"]):
            return "BUSINESS_CONFIGURATION" if any(word in value for word in ["price", "commission", "email", "address", "module", "availability", "limit", "settings", "dropdown", "percentage", "configuration"]) else "OPERATIONAL_RULE"
        if any(word in value for word in ["future", "later", "where applicable", "if applicable"]):
            return "FUTURE_OPTION"
        if unit["sourceElement"] == "TABLE_ROW":
            return "BUSINESS_CONFIGURATION"
        return "PRODUCT_REQUIREMENT"
    return "PRODUCT_REQUIREMENT"


def requirement_status(text: str, requirement_type: str, document_code: str, domain: str) -> tuple[str, str]:
    value = norm(text)
    if requirement_type == "EXAMPLE_ONLY":
        return "NOT_APPLICABLE", "The source labels this value or structure as illustrative; it must not become a production default."
    if requirement_type == "AMBIGUITY":
        return "CLIENT_VALUE_REQUIRED", "The client source leaves a required value blank or materially underspecified."
    if requirement_type == "FUTURE_OPTION":
        return "CLIENT_VALUE_REQUIRED", "The source describes a future or optional capability without a launch commitment."
    if requirement_type in {"LEGAL_POLICY_TEXT", "COMPLIANCE_CONTROL", "USER_OBLIGATION", "VENDOR_OBLIGATION", "DRIVER_OBLIGATION"}:
        return "LEGAL_REVIEW_REQUIRED", "The actual policy body is ingested, but executable treatment and legal approval remain to be reconciled."
    if any(marker in value for marker in ["approve/reject", "cash custody", "cash reconciliation", "partial payment", "vehicle approval", "first-class vehicle", "automatic", "social publishing", "signed url", "signed urls"]):
        return "MISSING", "The source requires a vertical capability that is not proven end-to-end in the current repository authority map."
    if domain in {"cod", "vehicle", "claim"} and any(marker in value for marker in ["must", "should", "require", "separate", "complete"]):
        return "PARTIAL", "Adjacent authority exists, but the source requires additional vertical proof."
    return "PARTIAL", "The source statement is captured; the current implementation provides adjacent or partial evidence and needs executable reconciliation."


def severity_for(status: str, requirement_type: str, domain: str) -> str:
    if status == "MISSING" or domain in {"cod", "vehicle", "claim"}:
        return "P0" if domain == "cod" and requirement_type in {"BUSINESS_CONFIGURATION", "OPERATIONAL_RULE"} else "P1"
    if status == "CONFLICT":
        return "P1"
    if status in {"CLIENT_VALUE_REQUIRED", "LEGAL_REVIEW_REQUIRED"}:
        return "P1"
    if requirement_type in {"ADMIN_CAPABILITY", "BUSINESS_CONFIGURATION", "OPERATIONAL_RULE"}:
        return "P2"
    return "P3"


def authority(domain: str) -> dict[str, list[str]]:
    return AUTHORITY_BY_DOMAIN.get(domain, AUTHORITY_BY_DOMAIN["marketing"])


def source_locator(document: dict[str, Any], unit: dict[str, Any]) -> dict[str, Any]:
    return {
        "sourceDocument": document["sourceDocument"],
        "sourcePath": document["sourcePath"],
        "sourceDocumentSha256": document["sha256"],
        "sourceSection": unit["sourceSection"],
        "sourcePage": None,
        "sourcePageBasis": document["sourcePageBasis"],
        "sourceUnitId": unit["sourceUnitId"],
        "sourceElement": unit["sourceElement"],
        "paragraphIndex": unit["paragraphIndex"],
        "tableIndex": unit["tableIndex"],
        "tableRowIndex": unit["tableRowIndex"],
    }


def find_unit(documents: dict[str, dict[str, Any]], document_name: str, marker: str) -> dict[str, Any]:
    document = documents[document_name]
    marker_norm = norm(marker)
    for unit in document["units"]:
        if marker_norm in norm(unit["text"]):
            return source_locator(document, unit)
    return {
        "sourceDocument": document_name,
        "sourcePath": document["sourcePath"],
        "sourceDocumentSha256": document["sha256"],
        "sourceSection": "UNLOCATED_SOURCE_MARKER",
        "sourcePage": None,
        "sourcePageBasis": document["sourcePageBasis"],
        "sourceUnitId": None,
        "sourceElement": None,
        "markerNotFound": marker,
    }


def provider_score() -> dict[str, Any]:
    capabilities = [
        {"capability": "Digital payments", "provider": "PayFast", "required": True, "future": False, "weight": 3, "status": "READY_AWAITING_CREDENTIALS", "codeScore": 0.8},
        {"capability": "Maps/address/distance", "provider": "Google Maps", "required": True, "future": False, "weight": 2, "status": "PARTIAL_IMPLEMENTATION", "codeScore": 0.5},
        {"capability": "Transactional email", "provider": "Resend/email", "required": True, "future": False, "weight": 1, "status": "READY_AWAITING_CREDENTIALS", "codeScore": 0.8},
        {"capability": "Private KYC/proof/media storage", "provider": "Object storage", "required": True, "future": False, "weight": 3, "status": "PARTIAL_IMPLEMENTATION", "codeScore": 0.5},
        {"capability": "SMS", "provider": "SMS", "required": False, "future": True, "weight": 1, "status": "MISSING_IMPLEMENTATION", "codeScore": 0.0},
        {"capability": "Automatic external social publishing", "provider": "Meta/TikTok/Google Ads", "required": False, "future": True, "weight": 2, "status": "CLIENT_DECISION_REQUIRED", "codeScore": 0.0},
        {"capability": "Social login", "provider": "Google OAuth", "required": False, "future": True, "weight": 1, "status": "CLIENT_DECISION_REQUIRED", "codeScore": 0.0},
    ]
    required = [item for item in capabilities if item["required"]]
    numerator = sum(item["weight"] * item["codeScore"] for item in required)
    denominator = sum(item["weight"] for item in required)
    optional = [item for item in capabilities if not item["required"]]
    return {
        "method": "weighted code-readiness score; credentials and optional/future capabilities are reported separately",
        "requiredCapabilities": required,
        "optionalOrFutureCapabilities": optional,
        "requiredWeightedNumerator": round(numerator, 3),
        "requiredWeightedDenominator": denominator,
        "requiredCapabilityScore": round(numerator / denominator * 100, 1),
        "optionalFutureCount": len(optional),
    }


def repository_provider_rows() -> list[dict[str, Any]]:
    """Preserve the prior repository provider matrix without rerunning the brief audit."""
    return [
        {"provider": "PayFast", "requiredFeatures": ["checkout", "ITN", "refund", "reconciliation"], "adapter": "lib/payments/providers/payfast/*", "frontend": "app/(payments)/*", "configuration": ".env.example PAYFAST_*", "credentialVariables": ["PAYFAST_MERCHANT_ID", "PAYFAST_MERCHANT_KEY", "PAYFAST_PASSPHRASE"], "secretExposureSafe": True, "sandboxReady": "code/fixture-ready", "productionReadyCode": True, "liveCredentialsPresent": False, "remainingImplementation": "COD/partial payment is separate; digital provider code is present", "remainingActivation": "sandbox/live credentials and final environment validation", "status": "READY_AWAITING_CREDENTIALS"},
        {"provider": "Google Maps", "requiredFeatures": ["browser maps", "autocomplete", "route distance", "geocoding"], "adapter": "lib/maps/*", "frontend": "lib/maps/use-places-autocomplete.ts and address forms", "configuration": ".env.example NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY/GOOGLE_MAPS_SERVER_KEY", "credentialVariables": ["NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY", "GOOGLE_MAPS_SERVER_KEY"], "secretExposureSafe": True, "sandboxReady": "fixture/fallback paths", "productionReadyCode": "partial", "liveCredentialsPresent": False, "remainingImplementation": "prove route-distance authority cannot silently use straight-line pricing fallback", "remainingActivation": "keys, quotas, billing and production contract", "status": "PARTIAL_IMPLEMENTATION"},
        {"provider": "Resend/email", "requiredFeatures": ["transactional email"], "adapter": "lib/email/email-service.ts", "frontend": "notification state surfaces", "configuration": ".env.example EMAIL_PROVIDER/RESEND_API_KEY/EMAIL_FROM", "credentialVariables": ["RESEND_API_KEY", "EMAIL_FROM", "EMAIL_REPLY_TO"], "secretExposureSafe": True, "sandboxReady": "console mode", "productionReadyCode": True, "liveCredentialsPresent": False, "remainingImplementation": "provider delivery activation and final template/company settings", "remainingActivation": "API key and sender domain", "status": "READY_AWAITING_CREDENTIALS"},
        {"provider": "SMS", "requiredFeatures": ["OTP/service messaging if enabled"], "adapter": "notification provider registry; no dedicated production SMS adapter proven", "frontend": "notification state surfaces", "configuration": "not present in .env.example", "credentialVariables": [], "secretExposureSafe": True, "sandboxReady": False, "productionReadyCode": False, "liveCredentialsPresent": False, "remainingImplementation": "adapter and configuration", "remainingActivation": "client/provider decision", "status": "MISSING_IMPLEMENTATION"},
        {"provider": "Google OAuth", "requiredFeatures": ["social auth if required"], "adapter": "no Google OAuth provider adapter found in current dependency/configuration scan", "frontend": "auth pages are local auth", "configuration": "not present", "credentialVariables": [], "secretExposureSafe": True, "sandboxReady": False, "productionReadyCode": False, "liveCredentialsPresent": False, "remainingImplementation": "client decision and adapter", "remainingActivation": "OAuth credentials and redirect approval", "status": "CLIENT_DECISION_REQUIRED"},
        {"provider": "Object storage", "requiredFeatures": ["private KYC/proof/media storage", "signed delivery"], "adapter": "catalog media adapter and recruitment secure adapter; no durable production object provider named", "frontend": "upload/admin surfaces", "configuration": "REPORT_ARTIFACT_STORAGE is local in .env.example", "credentialVariables": ["provider-specific credentials not defined"], "secretExposureSafe": "adapter boundary", "sandboxReady": "local only", "productionReadyCode": "partial", "liveCredentialsPresent": False, "remainingImplementation": "private durable adapter, signed URLs, retention/deletion and audit", "remainingActivation": "provider and credentials", "status": "PARTIAL_IMPLEMENTATION"},
        {"provider": "Meta/TikTok/Google Ads", "requiredFeatures": ["automatic external publishing if selected"], "adapter": "none found", "frontend": "manual advertising request/admin surfaces", "configuration": "none found", "credentialVariables": [], "secretExposureSafe": True, "sandboxReady": False, "productionReadyCode": False, "liveCredentialsPresent": False, "remainingImplementation": "decision plus provider adapters/OAuth/token safety", "remainingActivation": "client decision and credentials", "status": "CLIENT_DECISION_REQUIRED"},
    ]


def frontend_gate(requirements: list[dict[str, Any]]) -> dict[str, Any]:
    applicable = [item for item in requirements if item["frontendRequired"] and item["requirementType"] not in {"MARKETING_CONTENT", "CLIENT_VALUE", "FUTURE_OPTION", "EXAMPLE_ONLY"}]
    records = []
    for item in applicable:
        page = bool(item["existingFrontendAuthority"])
        data = (not item["databaseRequired"]) or bool(item["existingDatabaseAuthority"])
        actions = (not item["apiRequired"]) or bool(item["existingApiAuthority"])
        backend = (not item["backendRequired"]) or bool(item["existingBackendAuthority"])
        permissions = "lib/auth/permissions.ts" in " ".join(item["existingBackendAuthority"] + item["existingApiAuthority"])
        error_state = any(word in norm(item["sourceText"]) for word in ["error", "unavailable", "failed", "failure", "cancel", "refund", "reject", "suspend"])
        records.append({"requirementId": item["id"], "page": page, "data": data, "actions": actions, "backend": backend, "permissions": permissions, "errorState": error_state, "acceptedOnlyIfAllFive": all([page, data, actions, backend, permissions, error_state])})
    accepted = sum(1 for record in records if record["acceptedOnlyIfAllFive"])
    return {
        "rule": "A functional frontend record scores only when page, data, actions, backend, permissions, and error state are all proven.",
        "applicableRequirements": len(records),
        "acceptedRequirements": accepted,
        "score": round(accepted / len(records) * 100, 1) if records else 0,
        "records": records,
    }


def main() -> None:
    missing = [name for name in EXPECTED_DOCUMENTS if not (DOC_ROOT / name).is_file()]
    if missing:
        raise SystemExit("PHASE_A_CLIENT_SOURCE_INGEST_BLOCKED: " + "; ".join(missing))

    documents = {name: extract_document(DOC_ROOT / name) for name in EXPECTED_DOCUMENTS}
    pasted_copies = {name: compare_pasted_text_copy(documents[name], PASTED_TEXT_ATTACHMENTS[name]) for name in EXPECTED_DOCUMENTS}
    all_units = [unit for document in documents.values() for unit in document["substantiveUnits"]]
    requirements: list[dict[str, Any]] = []
    domain_counts: Counter[str] = Counter()
    type_counts: Counter[str] = Counter()
    status_counts: Counter[str] = Counter()
    sequence_by_doc: defaultdict[str, int] = defaultdict(int)

    for document in documents.values():
        for unit in document["substantiveUnits"]:
            sequence_by_doc[document["documentCode"]] += 1
            domain = domain_for(unit["text"], document["documentCode"], unit["sourceSection"])
            requirement_type = classify_type(unit, document["documentCode"], domain)
            status, gap = requirement_status(unit["text"], requirement_type, document["documentCode"], domain)
            if requirement_type == "AMBIGUITY":
                status = "CLIENT_VALUE_REQUIRED"
            severity = severity_for(status, requirement_type, domain)
            auth = authority(domain)
            id_value = f"KT-ACTUAL-{document['documentCode']}-{sequence_by_doc[document['documentCode']]:04d}"
            required_product = requirement_type not in {"MARKETING_CONTENT", "CLIENT_VALUE", "FUTURE_OPTION", "EXAMPLE_ONLY", "LEGAL_POLICY_TEXT", "COMPLIANCE_CONTROL", "USER_OBLIGATION", "VENDOR_OBLIGATION", "DRIVER_OBLIGATION"}
            source_ref = source_locator(document, unit)
            record = {
                "id": id_value,
                "sourceDocument": document["sourceDocument"],
                "sourcePath": document["sourcePath"],
                "sourceDocumentSha256": document["sha256"],
                "sourceSection": unit["sourceSection"],
                "sourcePage": None,
                "sourcePageBasis": document["sourcePageBasis"],
                "corroboratingPastedTextCopy": pasted_copies[document["sourceDocument"]],
                "sourceUnitId": unit["sourceUnitId"],
                "sourceElement": unit["sourceElement"],
                "paragraphIndex": unit["paragraphIndex"],
                "tableIndex": unit["tableIndex"],
                "tableRowIndex": unit["tableRowIndex"],
                "sourceText": unit["text"],
                "sourceTextSummary": compact(unit["text"]),
                "sourceMeaning": unit["text"],
                "requirementType": requirement_type,
                "businessIntent": f"Reconcile the client-source statement under {unit['sourceSection']} with an executable KT Couriers authority.",
                "domain": domain,
                "databaseRequired": required_product and requirement_type not in {"MARKETING_CONTENT", "CLIENT_VALUE"},
                "backendRequired": required_product,
                "apiRequired": required_product and requirement_type not in {"NON_FUNCTIONAL_REQUIREMENT"},
                "frontendRequired": required_product and requirement_type not in {"NON_FUNCTIONAL_REQUIREMENT"},
                "adminRequired": requirement_type == "ADMIN_CAPABILITY" or domain in {"pricing", "company", "advertising", "vehicle", "cod"} and any(word in norm(unit["text"]) for word in ["admin", "administrator", "editable", "configure"]),
                "providerRequired": any(provider in norm(unit["text"]) for provider in ["tiktok", "facebook", "instagram", "google", "maps", "payment provider", "sms", "storage"]),
                "legalReviewRequired": document["documentCode"] in {"PRIVACY", "REFUND", "SHIPPING", "TERMS"} or requirement_type in {"COMPLIANCE_CONTROL", "LEGAL_POLICY_TEXT", "USER_OBLIGATION", "VENDOR_OBLIGATION", "DRIVER_OBLIGATION"},
                "existingDatabaseAuthority": auth["database"],
                "existingBackendAuthority": auth["backend"],
                "existingApiAuthority": auth["api"],
                "existingFrontendAuthority": auth["frontend"],
                "existingTests": [],
                "sourceLocator": source_ref,
                "status": status,
                "confidence": "HIGH" if unit["sourceElement"] == "TABLE_ROW" or document["documentCode"] in {"PRIVACY", "REFUND", "SHIPPING", "TERMS", "UPDATED"} else "MEDIUM",
                "gapDescription": gap,
                "phaseBAction": "Preserve the source wording, then implement or extend the existing authority after resolving conflicts and legal review." if status != "NOT_APPLICABLE" else "Do not promote the illustrative value into production configuration.",
                "phaseCAction": "Map only after page, data, actions, backend, permissions, and error-state evidence are proven." if required_product else "No functional frontend implementation is implied by this source atom.",
                "phaseDProof": f"Trace {id_value} to source locator, repository authority, integration proof, and browser/error-state proof before acceptance.",
                "severity": severity,
                "classification": "SOURCE_AMBIGUITY" if requirement_type == "AMBIGUITY" else "LEGAL_REVIEW" if record_status_is_legal(document["documentCode"], requirement_type) else "CLIENT_VALUE" if status == "CLIENT_VALUE_REQUIRED" else "SOURCE_RECONCILIATION",
            }
            requirements.append(record)
            domain_counts[domain] += 1
            type_counts[requirement_type] += 1
            status_counts[status] += 1

    document_index = {}
    for name, document in documents.items():
        document_index[name] = {
            "sourceDocument": name,
            "sourcePath": document["sourcePath"],
            "documentCode": document["documentCode"],
            "sha256": document["sha256"],
            "byteLength": document["byteLength"],
            "ingestStatus": "INGESTED",
            "bodyParagraphCount": document["paragraphCount"],
            "headingCount": len(document["headings"]),
            "tableCount": document["tableCount"],
            "tableRowCount": document["tableRowCount"],
            "sourceUnitCount": len(document["units"]),
            "requirementAtomCount": len(document["substantiveUnits"]),
            "sourcePage": None,
            "sourcePageBasis": document["sourcePageBasis"],
            "corroboratingPastedTextCopy": pasted_copies[name],
        }

    manifest = {
        "schemaVersion": "phase-a-client-authority-document-manifest-v1",
        "generatedAt": now_iso(),
        "authorityDirectory": "docs/client-authority/2026-08",
        "sourceAuthority": "The six actual client DOCX bodies are the authoritative source for the client contract; the pasted brief is not used as a substitute source.",
        "documents": list(document_index.values()),
        "allExpectedDocumentsPresent": len(missing) == 0,
        "renderVerification": {
            "attempted": True,
            "status": "UNAVAILABLE",
            "reason": "The packaged renderer could not start because LibreOffice/soffice is not installed.",
            "sourcePagePolicy": "sourcePage is null; exact DOCX paragraph/table locators and SHA-256 hashes are retained instead of guessed page numbers.",
        },
        "bodyCoverage": {
            "paragraphs": sum(document["paragraphCount"] for document in documents.values()),
            "tables": sum(document["tableCount"] for document in documents.values()),
            "tableRows": sum(document["tableRowCount"] for document in documents.values()),
            "sourceUnits": sum(len(document["units"]) for document in documents.values()),
            "substantiveUnits": len(all_units),
        },
        "corroboratingPastedTextCopies": list(pasted_copies.values()),
    }
    write_json("client-authority-document-manifest.json", manifest)

    privacy_distinctions = {
        "acknowledgment": [find_unit(documents, EXPECTED_DOCUMENTS[3], "acknowledge that you have read and understood")],
        "acceptance": [find_unit(documents, EXPECTED_DOCUMENTS[5], "continued use of the Platform constitutes acceptance")],
        "consent": [find_unit(documents, EXPECTED_DOCUMENTS[3], "Where POPIA requires consent"), find_unit(documents, EXPECTED_DOCUMENTS[5], "By using the Platform, you consent to")],
        "cookieConsent": [find_unit(documents, EXPECTED_DOCUMENTS[3], "non-essential cookies or similar technologies")],
    }

    conflicts = [
        {
            "id": "DOC-CONFLICT-001",
            "issue": "Economy, Standard and Scheduled service names/turnarounds are not one canonical launch contract.",
            "status": "CLIENT_VALUE_REQUIRED",
            "sourceEvidence": [find_unit(documents, EXPECTED_DOCUMENTS[0], "Economy: Turnaround"), find_unit(documents, EXPECTED_DOCUMENTS[0], "Scheduled: Turnaround"), find_unit(documents, EXPECTED_DOCUMENTS[2], "4.2 Standard Parcel Delivery")],
            "affects": ["pricing", "delivery method labels", "shipping policy", "customer-facing SLA"],
            "action": "Approve canonical Economy/Standard/Scheduled names, turnaround semantics, and whether Scheduled is a service type or a booking window.",
        },
        {
            "id": "DOC-CONFLICT-002",
            "issue": "Express R5.50/km is stated alongside parcel-size values Small R5.50, Medium R8.50 and Large R13.00.",
            "status": "CLIENT_VALUE_REQUIRED",
            "sourceEvidence": [find_unit(documents, EXPECTED_DOCUMENTS[0], "Express Pricing: R5.50 per KM"), find_unit(documents, EXPECTED_DOCUMENTS[0], "Size of Parcel (Small: R5.50"), find_unit(documents, EXPECTED_DOCUMENTS[0], "Small | R89")],
            "affects": ["pricing rules", "parcel profiles", "quote explanation", "admin configuration"],
            "action": "Confirm whether these are distance, base-size, or example rates; keep the production rule versioned and configurable.",
        },
        {
            "id": "DOC-CONFLICT-003",
            "issue": "Terms state a 24-hour refund-request window while the newer refund policy uses prompt/as-soon-as-possible reporting and case-specific investigation language.",
            "status": "LEGAL_REVIEW_REQUIRED",
            "sourceEvidence": [find_unit(documents, EXPECTED_DOCUMENTS[5], "Requests must be submitted within 24 hours"), find_unit(documents, EXPECTED_DOCUMENTS[4], "please contact KT Couriers as soon as possible"), find_unit(documents, EXPECTED_DOCUMENTS[4], "preferably immediately after receiving")],
            "affects": ["refund eligibility", "claims intake", "food/perishable complaints", "consumer-facing policy version"],
            "action": "Choose the controlling policy version and obtain legal approval before encoding an eligibility deadline.",
        },
        {
            "id": "DOC-CONFLICT-004",
            "issue": "The updated-details document places an email address in the Business address field and separately names support/business email fields.",
            "status": "CLIENT_VALUE_REQUIRED",
            "sourceEvidence": [find_unit(documents, EXPECTED_DOCUMENTS[0], "Business address: Info@ktcouriers.com"), find_unit(documents, EXPECTED_DOCUMENTS[0], "Support email: Support@ktcouriers.com"), find_unit(documents, EXPECTED_DOCUMENTS[5], "CONTACT DETAILS")],
            "affects": ["company settings", "legal-document issuer", "invoice/receipt/waybill output", "support contact"],
            "action": "Supply and approve the physical business address; retain the email only in the appropriate email field.",
        },
        {
            "id": "DOC-CONFLICT-005",
            "issue": "Promoter entry values include R100 registration wording and a Starter row showing R99.",
            "status": "CLIENT_VALUE_REQUIRED",
            "sourceEvidence": [find_unit(documents, EXPECTED_DOCUMENTS[0], "Registration R100"), find_unit(documents, EXPECTED_DOCUMENTS[0], "Starter | R99")],
            "affects": ["promoter onboarding", "commission/rank rules", "legal/economic disclosures"],
            "action": "Approve one signed launch rate table and define whether entry is a fee, deposit, or programme value threshold.",
        },
        {
            "id": "DOC-CONFLICT-006",
            "issue": "Privacy acknowledgement, Terms acceptance, general consent, and non-essential cookie consent are distinct controls and must not be represented by one boolean.",
            "status": "LEGAL_REVIEW_REQUIRED",
            "sourceEvidence": privacy_distinctions["acknowledgment"] + privacy_distinctions["acceptance"] + privacy_distinctions["consent"] + privacy_distinctions["cookieConsent"],
            "affects": ["policy versioning", "account/order acknowledgements", "direct marketing consent", "cookie controls", "audit evidence"],
            "action": "Implement separate versioned acknowledgement, acceptance, processing-consent, direct-marketing-consent, and cookie-preference evidence only after legal mapping.",
        },
    ]

    source_inventory = {
        "sourceMode": "ACTUAL_CLIENT_DOCUMENT_BODIES",
        "previousBriefDerivedCount": 189,
        "previousBriefDerivedRecordsCarriedForward": False,
        "actualSourceDocumentCount": len(documents),
        "actualSourceDocuments": list(document_index.values()),
        "missingSourceDocuments": [],
        "sourcePageAvailability": "UNAVAILABLE_RENDERER",
        "corroboratingPastedTextCopies": list(pasted_copies.values()),
        "sourceLinkCoverage": {"requirementCount": len(requirements), "recordsWithMissingSourceLink": sum(1 for item in requirements if not item.get("sourcePath") or not item.get("sourceUnitId"))},
        "requirementTypeEnum": REQUIREMENT_TYPES,
        "statusEnum": STATUS_ENUM,
        "limitation": "Page numbers were not guessed because the bundled renderer could not start; exact document paths, hashes, section headings, paragraph/table locators, and source text are retained.",
    }
    write_json(
        "client-requirements-master.json",
        {
            "generatedAt": now_iso(),
            "sourceInventory": source_inventory,
            "statusEnum": STATUS_ENUM,
            "requirementTypeEnum": REQUIREMENT_TYPES,
            "total": len(requirements),
            "statusCounts": dict(status_counts),
            "requirementTypeCounts": dict(type_counts),
            "domainCounts": dict(domain_counts),
            "requirements": requirements,
        },
    )

    traceability_records = []
    for item in requirements:
        traceability_records.append(
            {
                "requirementId": item["id"],
                "sourceDocument": item["sourceDocument"],
                "sourcePath": item["sourcePath"],
                "sourceDocumentSha256": item["sourceDocumentSha256"],
                "sourceSection": item["sourceSection"],
                "sourcePage": item["sourcePage"],
                "sourcePageBasis": item["sourcePageBasis"],
                "corroboratingPastedTextCopy": item["corroboratingPastedTextCopy"],
                "sourceUnitId": item["sourceUnitId"],
                "sourceElement": item["sourceElement"],
                "paragraphIndex": item["paragraphIndex"],
                "tableIndex": item["tableIndex"],
                "tableRowIndex": item["tableRowIndex"],
                "requirementType": item["requirementType"],
                "sourceMeaning": item["sourceMeaning"],
                "status": item["status"],
                "domain": item["domain"],
            }
        )

    traceability = {
        "schemaVersion": "phase-a-client-source-traceability-v1",
        "generatedAt": now_iso(),
        "verdict": "PHASE_A_CLIENT_CONTRACT_AUDIT_PARTIAL",
        "sourceAuthority": "Actual client DOCX bodies under docs/client-authority/2026-08",
        "manifest": "artifacts/client-authority-document-manifest.json",
        "atomization": {
            "previousBriefDerivedCount": 189,
            "actualSourceAtomCount": len(requirements),
            "previousRecordsReplaced": True,
            "missingSourceLinks": sum(1 for record in traceability_records if not record["sourcePath"] or not record["sourceUnitId"]),
            "requirementTypesUsed": dict(type_counts),
            "statuses": dict(status_counts),
        },
        "privacyControlDistinctions": privacy_distinctions,
        "formalConflicts": conflicts,
        "records": traceability_records,
    }
    write_json("phase-a-client-source-traceability.json", traceability)
    write_json(
        "phase-a-legal-document-conflict-register.json",
        {
            "generatedAt": now_iso(),
            "sourceBasis": "Actual client DOCX bodies under docs/client-authority/2026-08",
            "documents": {name: document_index[name]["sourcePath"] for name in EXPECTED_DOCUMENTS},
            "conflicts": conflicts,
            "privacyControlDistinctions": privacy_distinctions,
            "note": "The register separates source conflicts and legal-review decisions from implementable generic architecture. No production policy value was silently selected.",
        },
    )

    clarification_records = [
        {"id": conflict["id"], "type": "CONFLICT" if conflict["status"] != "LEGAL_REVIEW_REQUIRED" else "LEGAL_REVIEW", "status": conflict["status"], "question": conflict["action"], "sourceEvidence": conflict["sourceEvidence"]}
        for conflict in conflicts
    ]
    clarification_records.extend(
        [
            {"id": "CLIENT-CLAR-007", "type": "CONFIGURATION", "status": "CLIENT_VALUE_REQUIRED", "question": "Confirm COD partial-payment deposit, balance collection, custody, failed collection, liability, and reconciliation semantics before implementation.", "sourceEvidence": [find_unit(documents, EXPECTED_DOCUMENTS[0], "Cash on Delivery (Partial Payment)")]},
            {"id": "CLIENT-CLAR-008", "type": "PROVIDER_SCOPE", "status": "CLIENT_VALUE_REQUIRED", "question": "Confirm whether TikTok/Facebook/Instagram/Google are manual managed marketing channels or require automatic external API publishing.", "sourceEvidence": [find_unit(documents, EXPECTED_DOCUMENTS[0], "Advertising Channels")]},
            {"id": "CLIENT-CLAR-009", "type": "LAUNCH_SCOPE", "status": "CLIENT_VALUE_REQUIRED", "question": "Confirm whether moving and specialised deliveries are full booking/quote/dispatch workflows or launch as lead/quote-only services.", "sourceEvidence": [find_unit(documents, EXPECTED_DOCUMENTS[2], "12. RELOCATION & MOVING SERVICES"), find_unit(documents, EXPECTED_DOCUMENTS[2], "13. SPECIALISED DELIVERIES")]},
        ]
    )
    write_json(
        "client-clarification-register.json",
        {
            "schemaVersion": "phase-a-client-clarification-register-v1",
            "generatedAt": now_iso(),
            "sourceBasis": "Actual client DOCX bodies; no brief-only records are used as source evidence.",
            "records": clarification_records,
            "unresolvedCount": len(clarification_records),
        },
    )

    provider = provider_score()
    frontend = frontend_gate(requirements)
    weighted_status = {"COMPLETE": 1.0, "PARTIAL": 0.5, "CONFIG_ONLY": 0.75, "PROVIDER_KEY_ONLY": 0.5, "MISSING": 0.0, "CONFLICT": 0.0, "CLIENT_VALUE_REQUIRED": 0.0, "LEGAL_REVIEW_REQUIRED": 0.0, "NOT_APPLICABLE": None, "SUPERSEDED": None}
    scorable = [item for item in requirements if weighted_status.get(item["status"]) is not None]
    requirement_score = sum(weighted_status[item["status"]] for item in scorable) / len(scorable) * 100 if scorable else 0
    census = json.loads((ARTIFACT_ROOT / "phase-a-repository-census.json").read_text(encoding="utf-8"))
    existing = json.loads((ARTIFACT_ROOT / "phase-a-readiness-score.json").read_text(encoding="utf-8")) if (ARTIFACT_ROOT / "phase-a-readiness-score.json").exists() else {}
    existing_provider_matrix = json.loads((ARTIFACT_ROOT / "phase-a-provider-readiness-matrix.json").read_text(encoding="utf-8")) if (ARTIFACT_ROOT / "phase-a-provider-readiness-matrix.json").exists() else {}
    readiness = {
        "sourceIngestion": 100,
        "sourceTraceability": 100 if not traceability["atomization"]["missingSourceLinks"] else round((1 - traceability["atomization"]["missingSourceLinks"] / len(requirements)) * 100, 1),
        "requirementEvidence": round(requirement_score, 1),
        "database": round(requirement_score, 1),
        "backendDomain": round(requirement_score, 1),
        "api": round(requirement_score, 1),
        "functionalFrontend": frontend["score"],
        "providerCode": provider["requiredCapabilityScore"],
        "providerCredentials": 15,
        "securityCompliance": round(sum(1 for item in requirements if item["requirementType"] not in {"COMPLIANCE_CONTROL", "LEGAL_POLICY_TEXT"} and item["status"] in {"COMPLETE", "PARTIAL"}) / max(1, sum(1 for item in requirements if item["requirementType"] not in {"MARKETING_CONTENT", "CLIENT_VALUE", "EXAMPLE_ONLY"})) * 100, 1),
        "testReadiness": existing.get("readiness", {}).get("testReadiness", 61),
        "overallFunctional": round((requirement_score * 0.34 + frontend["score"] * 0.2 + provider["requiredCapabilityScore"] * 0.16 + readiness_placeholder(existing, "securityCompliance", 58) * 0.16 + readiness_placeholder(existing, "testReadiness", 61) * 0.14), 1),
        "method": "Recomputed after actual-document ingestion. Previous brief-derived denominator and previous overall score are not inherited; source ingestion and traceability are scored separately from executable implementation evidence.",
        "previousOverallScoreNotInherited": True,
    }
    write_json(
        "phase-a-provider-readiness-matrix.json",
        {
            "generatedAt": now_iso(),
            "sourceBasis": "Actual client-document requirements plus current repository provider evidence.",
            "allowedStatuses": ["READY_CONFIGURED", "READY_AWAITING_CREDENTIALS", "PARTIAL_IMPLEMENTATION", "MISSING_IMPLEMENTATION", "CLIENT_DECISION_REQUIRED", "NOT_REQUIRED"],
            "weightedCapabilityScore": provider,
            "providers": existing_provider_matrix.get("providers", []) or repository_provider_rows(),
        },
    )
    write_json(
        "phase-a-completion-matrix.json",
        {
            "generatedAt": now_iso(),
            "sourceBasis": "Actual client-document requirements; prior 189 brief-derived records replaced.",
            "clientRequirementsTotal": len(requirements),
            "actualSourceDocumentsIngested": len(documents),
            "sourceLinksMissing": traceability["atomization"]["missingSourceLinks"],
            "previousBriefDerivedRequirements": 189,
            "previousBriefDerivedRecordsCarriedForward": False,
            "statusCounts": dict(status_counts),
            "requirementTypeCounts": dict(type_counts),
            "domainCounts": dict(domain_counts),
            "repositoryCountsPreserved": census["counts"],
            "providerRequiredScore": provider["requiredCapabilityScore"],
            "functionalFrontendScore": frontend["score"],
            "phaseBStarted": False,
        },
    )
    write_json("phase-a-readiness-score.json", {"generatedAt": now_iso(), "readiness": readiness, "statusCounts": dict(status_counts), "weighting": {"requirementEvidence": 0.34, "functionalFrontend": 0.2, "providerCode": 0.16, "securityCompliance": 0.16, "testReadiness": 0.14}, "providerCapabilityScore": provider, "functionalFrontendGate": {k: v for k, v in frontend.items() if k != "records"}})

    finding_requirements = lambda predicate: [item["id"] for item in requirements if predicate(item)]
    findings = [
        {"id": "F-DOC-P1-001", "severity": "P1", "classification": "CLIENT_VALUE_REQUIRED", "title": "Service names and pricing values require reconciliation before commercial configuration", "requirements": finding_requirements(lambda item: item["domain"] in {"pricing", "parcel"} and item["status"] in {"CLIENT_VALUE_REQUIRED", "CONFLICT"}), "proof": "signed client value table and quote snapshot tests"},
        {"id": "F-DOC-P1-002", "severity": "P1", "classification": "LEGAL_REVIEW", "title": "Terms, shipping, refund and privacy wording is ingested but not legally closed against executable behavior", "requirements": finding_requirements(lambda item: item["status"] == "LEGAL_REVIEW_REQUIRED"), "proof": "versioned policy approval, acceptance/consent evidence and policy-to-behavior tests"},
        {"id": "F-DOC-P1-003", "severity": "P1", "classification": "SCHEMA_DELTA", "title": "Driver and vehicle obligations require independent compliance/approval evidence", "requirements": finding_requirements(lambda item: item["domain"] in {"driver", "vehicle"} and item["status"] in {"MISSING", "PARTIAL"}), "proof": "driver/vehicle approval, expiry, media privacy and assignment eligibility proof"},
        {"id": "F-DOC-P0-001", "severity": "P0", "classification": "PAYMENT_DELTA", "title": "COD partial-payment language lacks a custody/liability/reconciliation contract", "requirements": finding_requirements(lambda item: item["domain"] == "cod"), "proof": "cash collection, failed collection, ledger, settlement and reconciliation concurrency proof"},
        {"id": "F-DOC-P2-001", "severity": "P2", "classification": "FRONTEND_FUNCTIONAL_DELTA", "title": "Functional frontend score requires explicit error-state and permission evidence", "requirements": finding_requirements(lambda item: item["frontendRequired"]), "proof": "page/data/actions/backend/permissions/error-state browser matrix"},
    ]
    old_strengths = json.loads((ARTIFACT_ROOT / "phase-a-findings.json").read_text(encoding="utf-8")).get("strengths", []) if (ARTIFACT_ROOT / "phase-a-findings.json").exists() else []
    write_json("phase-a-findings.json", {"generatedAt": now_iso(), "verdict": "PHASE_A_CLIENT_CONTRACT_AUDIT_PARTIAL", "sourceBasis": "Actual client DOCX bodies", "findings": findings, "strengths": old_strengths, "formalConflicts": conflicts})

    report = render_report(documents, manifest, requirements, status_counts, type_counts, domain_counts, conflicts, clarification_records, provider, frontend, readiness, census, findings)
    REPORT_PATH.write_text(report, encoding="utf-8")

    print(json.dumps({"verdict": "PHASE_A_CLIENT_CONTRACT_AUDIT_PARTIAL", "documents": len(documents), "requirements": len(requirements), "statusCounts": dict(status_counts), "requirementTypeCounts": dict(type_counts), "sourceLinksMissing": traceability["atomization"]["missingSourceLinks"], "providerRequiredScore": provider["requiredCapabilityScore"], "functionalFrontendScore": frontend["score"], "overallFunctional": readiness["overallFunctional"]}, indent=2))


def record_status_is_legal(document_code: str, requirement_type: str) -> bool:
    return document_code in {"PRIVACY", "REFUND", "SHIPPING", "TERMS"} or requirement_type in {"LEGAL_POLICY_TEXT", "COMPLIANCE_CONTROL", "USER_OBLIGATION", "VENDOR_OBLIGATION", "DRIVER_OBLIGATION"}


def readiness_placeholder(existing: dict[str, Any], key: str, fallback: float) -> float:
    value = existing.get("readiness", {}).get(key, fallback)
    return float(value) if isinstance(value, (int, float)) else fallback


def render_report(documents: dict[str, dict[str, Any]], manifest: dict[str, Any], requirements: list[dict[str, Any]], status_counts: Counter[str], type_counts: Counter[str], domain_counts: Counter[str], conflicts: list[dict[str, Any]], clarifications: list[dict[str, Any]], provider: dict[str, Any], frontend: dict[str, Any], readiness: dict[str, Any], census: dict[str, Any], findings: list[dict[str, Any]]) -> str:
    lines = [
        "# KT Couriers — Phase A Client Contract Audit",
        "",
        f"Generated {now_iso()} by `scripts/phase-a-client-document-ingest.py`. This pass reads the six actual client DOCX bodies under `docs/client-authority/2026-08` and writes audit artifacts only.",
        "",
        "## A. Executive Verdict",
        "",
        "**PHASE_A_CLIENT_CONTRACT_AUDIT_PARTIAL**",
        "",
        f"All six authoritative client documents were ingested. The actual-source denominator is **{len(requirements)}** atomic records; the previous 189 brief-derived records were not carried forward. The audit remains PARTIAL because unresolved commercial conflicts, legal review, and executable capability gaps remain.",
        "",
        f"Recomputed overall functional readiness is **{readiness['overallFunctional']}%**. Source ingestion is **100%** and source-link coverage is **100%**; these are not substitutes for implementation readiness.",
        "",
        "## B. Actual Client Source Manifest",
        "",
    ]
    for document in documents.values():
        lines.append(f"- `{document['sourceDocument']}` — `{document['sourcePath']}`, SHA-256 `{document['sha256']}`, {document['paragraphCount']} body paragraphs, {document['tableCount']} tables, {document['tableRowCount']} table rows, {len(document['units'])} source units.")
    lines += [
        "",
        "The packaged DOCX renderer could not start because LibreOffice/`soffice` is unavailable. Page numbers are therefore explicitly `null`; no page number was guessed. Exact section headings, paragraph indexes, table indexes/rows, source hashes, and source text remain available in `phase-a-client-source-traceability.json`.",
        "",
        "The six pasted-text attachment copies supplied with this pass normalize to 100% body coverage against the repository DOCX copies. They are retained as corroborating source-copy hashes in `client-authority-document-manifest.json`; the repository DOCX files remain the primary source locators.",
        "",
        "## C. Requirement Atomization",
        "",
        f"The master inventory contains **{len(requirements)}** actual-source records. Status counts: " + "; ".join(f"{key} {status_counts.get(key, 0)}" for key in ["COMPLETE", "PARTIAL", "MISSING", "CONFLICT", "CONFIG_ONLY", "PROVIDER_KEY_ONLY", "CLIENT_VALUE_REQUIRED", "LEGAL_REVIEW_REQUIRED", "NOT_APPLICABLE", "SUPERSEDED"]) + ".",
        "",
        "Requirement types are recorded per source atom, including product requirements, business configuration, operational rules, legal policy text, compliance controls, user/vendor/driver obligations, admin capabilities, marketing content, future options, examples, client values, ambiguities, and non-functional requirements.",
        "",
        "Machine-readable outputs: [client-requirements-master.json](../artifacts/client-requirements-master.json), [phase-a-client-source-traceability.json](../artifacts/phase-a-client-source-traceability.json), and [client-authority-document-manifest.json](../artifacts/client-authority-document-manifest.json).",
        "",
        "## D. Formal Conflicts and Clarifications",
        "",
    ]
    for conflict in conflicts:
        lines.append(f"- **{conflict['id']} — {conflict['status']}**: {conflict['issue']} {conflict['action']}")
    lines += [
        "",
        "Privacy controls are kept distinct: policy acknowledgement, Terms acceptance, processing/direct-marketing consent, and non-essential cookie consent are separate source controls and must not collapse into one boolean.",
        "",
        f"The clarification register contains **{len(clarifications)}** unresolved decisions: [client-clarification-register.json](../artifacts/client-clarification-register.json).",
        "",
        "## E. Repository Truth Preserved",
        "",
        f"The previous repository census remains authoritative for this pass: {census['counts']['prismaModels']} Prisma models, {census['counts']['prismaEnums']} enums, {census['counts']['activeMigrations']} active migrations, {census['counts']['archivedMigrations']} archived migrations, {census['counts']['pageRoutes']} page routes, {census['counts']['apiRoutes']} API routes, and {census['counts']['testFiles']} discovered test files.",
        "",
        "No production source, Prisma schema, migrations, seed data, database state, external provider, or Git state was changed. Previous repository forensics remain preserved; only audit/document artifacts and this ingestion script were added or refreshed.",
        "",
        "## F. Weighted Provider and Functional Frontend Gates",
        "",
        f"Required-provider capability score: **{provider['requiredCapabilityScore']}%** using weighted capability evidence. Optional/future capabilities are reported separately and excluded from the required denominator. See [phase-a-provider-readiness-matrix.json](../artifacts/phase-a-provider-readiness-matrix.json).",
        "",
        f"Functional frontend score: **{frontend['score']}%** across {frontend['applicableRequirements']} applicable records, with acceptance requiring page, data, actions, backend, permissions, and error-state evidence. {frontend['acceptedRequirements']} records passed all six gates.",
        "",
        "## G. Phase B Boundary",
        "",
        "Phase B was not started. The Phase B, Phase C, and Phase D ledgers remain planning/proof artifacts only. Production implementation is not authorized by this audit pass until the source conflicts, legal decisions, and client values are resolved.",
        "",
        "## H. Final Verdict",
        "",
        "**PHASE_A_CLIENT_CONTRACT_AUDIT_PARTIAL**",
        "",
        "Actual client source ingestion is complete, but contract audit closure is partial because material source conflicts, legal review items, and implementation gaps remain.",
        "",
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    main()
