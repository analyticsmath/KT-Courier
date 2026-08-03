# Catalog media security

Catalog media accepts only `image/jpeg`, `image/png` and `image/webp`. SVG, GIF, PDF, HTML, executable, scriptable, animated, polyglot and unrecognized content is rejected. Browser MIME, filename extension, client dimensions, checksum, storage key and owner identifiers are never authoritative.

The intake stream is capped at 8 MiB before concatenation. The server inspects PNG/JPEG/WebP signatures and container structure, derives MIME and dimensions, enforces a 300 × 300 minimum, 8,000 × 8,000 per-axis maximum, 25-megapixel maximum and aspect ratio between 1:8 and 8:1, then computes SHA-256 over server-opened bytes. Declared and detected type/size must agree.

No canonical transformation or metadata-stripping pipeline exists. The validator therefore rejects JPEG EXIF/XMP/IPTC/comment segments, PNG EXIF/text chunks and WebP EXIF/XMP chunks. This prevents known GPS/device-owner metadata from being served without claiming that transformation occurred. A reviewed malware/content scanner and full decoder remain Phase 26.5 requirements; uncertain inspection is quarantined.

Storage credentials, internal keys, upload authorization, original local filenames and complete checksums are absent from store/public DTOs. Admin UX receives only a truncated checksum fingerprint.
