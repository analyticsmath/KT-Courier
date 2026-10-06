#!/usr/bin/env python3
"""Build a sanitized source package from a phpMyAdmin 6amMart dump.

Only catalogue/store fields required by the KT migration are emitted. Legacy
passwords, remember tokens, OAuth data, configuration secrets, verification
tokens and unrelated tables are deliberately excluded.
"""
from __future__ import annotations
import argparse, csv, gzip, hashlib, json, pathlib, re

SAFE_COLUMNS = {
    "modules": ("id", "module_name", "module_type", "status"),
    "vendors": ("id", "f_name", "l_name", "phone", "email", "status", "created_at", "updated_at"),
    "stores": ("id", "name", "phone", "email", "logo", "cover_photo", "latitude", "longitude", "address", "status", "active", "vendor_id", "module_id", "featured", "delivery", "take_away", "minimum_order", "tax", "slug", "created_at", "updated_at"),
    "store_schedule": ("id", "store_id", "day", "opening_time", "closing_time", "created_at", "updated_at"),
    "categories": ("id", "name", "image", "parent_id", "position", "status", "module_id", "slug", "created_at", "updated_at"),
    "brands": ("id", "name", "image", "status", "slug", "created_at", "updated_at"),
    "units": ("id", "unit", "created_at", "updated_at"),
    "items": ("id", "name", "description", "image", "category_id", "category_ids", "variations", "add_ons", "attributes", "choice_options", "price", "tax", "tax_type", "discount", "discount_type", "status", "store_id", "created_at", "updated_at", "module_id", "stock", "unit_id", "images", "food_variations", "slug", "maximum_cart_quantity", "is_approved", "is_halal"),
    "ecommerce_item_details": ("id", "item_id", "brand_id", "created_at", "updated_at"),
    "add_ons": ("id", "name", "price", "store_id", "status", "created_at", "updated_at"),
}
JSON_COLUMNS = {("items", field) for field in ("category_ids", "variations", "add_ons", "attributes", "choice_options", "images", "food_variations")}
INT_COLUMNS = {"id", "status", "active", "vendor_id", "module_id", "featured", "delivery", "take_away", "parent_id", "position", "store_id", "category_id", "stock", "unit_id", "maximum_cart_quantity", "is_approved", "is_halal", "item_id", "brand_id", "day"}
FLOAT_COLUMNS = {"latitude", "longitude", "minimum_order", "tax", "price", "discount"}


def sha256_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_dump(path: pathlib.Path) -> str:
    if path.suffix == ".gz":
        with gzip.open(path, "rt", encoding="utf-8", errors="replace") as handle:
            return handle.read()
    return path.read_text(encoding="utf-8", errors="replace")


def split_rows(values: str):
    i, length = 0, len(values)
    while i < length:
        while i < length and values[i] in " \r\n,\t":
            i += 1
        if i >= length:
            return
        if values[i] != "(":
            raise ValueError(f"Unexpected INSERT syntax at offset {i}")
        i += 1
        row, token, in_string, escaped, quoted, nested = [], [], False, False, False, 0
        while i < length:
            char = values[i]
            if in_string:
                if escaped:
                    token.append({"n":"\n","r":"\r","t":"\t","0":"\0","Z":"\x1a"}.get(char, char))
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == "'":
                    if i + 1 < length and values[i + 1] == "'":
                        token.append("'")
                        i += 1
                    else:
                        in_string = False
                else:
                    token.append(char)
            else:
                if char == "'":
                    in_string, quoted = True, True
                elif char == "(":
                    nested += 1
                    token.append(char)
                elif char == ")" and nested > 0:
                    nested -= 1
                    token.append(char)
                elif char == "," and nested == 0:
                    raw = "".join(token).strip()
                    row.append(raw if quoted else (None if raw == "NULL" else raw))
                    token, quoted = [], False
                elif char == ")" and nested == 0:
                    raw = "".join(token).strip()
                    row.append(raw if quoted else (None if raw == "NULL" else raw))
                    i += 1
                    break
                else:
                    token.append(char)
            i += 1
        yield row


def parse_table(sql: str, table: str):
    pattern = re.compile(
        r"INSERT INTO `" + re.escape(table) + r"` \((.*?)\) VALUES\s*(.*?);\s*(?=\n|$)",
        re.S,
    )
    result = []
    for match in pattern.finditer(sql):
        columns = re.findall(r"`([^`]+)`", match.group(1))
        for values in split_rows(match.group(2)):
            if len(values) != len(columns):
                raise ValueError(
                    f"{table}: expected {len(columns)} values, found {len(values)}"
                )
            source, safe = dict(zip(columns, values)), {}
            for column in SAFE_COLUMNS[table]:
                value = source.get(column)
                if (table, column) in JSON_COLUMNS:
                    if value in (None, ""):
                        safe[column] = []
                    else:
                        try:
                            safe[column] = json.loads(str(value))
                        except (json.JSONDecodeError, TypeError):
                            safe[column] = []
                elif column in INT_COLUMNS and value not in (None, ""):
                    try:
                        safe[column] = int(str(value))
                    except ValueError:
                        safe[column] = None
                elif column in FLOAT_COLUMNS and value not in (None, ""):
                    try:
                        safe[column] = float(str(value))
                    except ValueError:
                        safe[column] = None
                else:
                    safe[column] = value
            result.append(safe)
    return result


def media_evidence(
    manifest_path: pathlib.Path,
    report_path: pathlib.Path,
    missing_path: pathlib.Path,
):
    relationships = {}
    with manifest_path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            filename = (row.get("filename") or "").strip()
            if filename:
                relationships.setdefault(filename, []).append(row)

    report = {}
    with report_path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            filename = (row.get("filename") or "").strip()
            if filename:
                size = int(row.get("size_bytes") or 0)
                report[filename] = {
                    "exists": True,
                    "byteSize": size,
                    "zeroByte": size == 0,
                    "sourcePath": row.get("source_path"),
                }

    missing = {
        line.strip().lstrip("\ufeff")
        for line in missing_path.read_text(encoding="utf-8-sig").splitlines()
        if line.strip()
    }

    return {
        filename: {
            "exists": report.get(filename, {}).get("exists", False)
            and filename not in missing,
            "byteSize": report.get(filename, {}).get("byteSize", 0),
            "zeroByte": report.get(filename, {}).get("zeroByte", False),
            "missing": filename in missing,
            "relationships": relationships.get(filename, []),
        }
        for filename in sorted(set(relationships) | set(report) | missing)
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sql", type=pathlib.Path, required=True)
    parser.add_argument("--database", required=True)
    parser.add_argument("--media-manifest", type=pathlib.Path, required=True)
    parser.add_argument("--media-report", type=pathlib.Path, required=True)
    parser.add_argument("--missing-list", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    args = parser.parse_args()

    sql = read_dump(args.sql)
    tables = {table: parse_table(sql, table) for table in SAFE_COLUMNS}
    brand_by_item = {
        row["item_id"]: row.get("brand_id")
        for row in tables["ecommerce_item_details"]
        if row.get("item_id") is not None
    }
    for item in tables["items"]:
        item["brand_id"] = brand_by_item.get(item.get("id"))

    package = {
        "packageVersion": 1,
        "source": {
            "system": "LEGACY_6AMMART",
            "database": args.database,
            "dumpSha256": sha256_file(args.sql),
        },
        "counts": {table: len(rows) for table, rows in tables.items()},
        "tables": {
            table: rows
            for table, rows in tables.items()
            if table != "ecommerce_item_details"
        },
        "media": media_evidence(
            args.media_manifest, args.media_report, args.missing_list
        ),
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(package, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "output": str(args.output),
                "outputSha256": sha256_file(args.output),
                "sourceSha256": package["source"]["dumpSha256"],
                "counts": package["counts"],
                "mediaFilenames": len(package["media"]),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
