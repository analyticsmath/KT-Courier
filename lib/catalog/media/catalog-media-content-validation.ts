import { createHash } from "node:crypto";
import { CatalogPolicyError } from "@/lib/catalog/errors";
import {
  CATALOG_MEDIA_MAX_UPLOAD_BYTES,
  assertCatalogMediaDimensions,
  isCatalogMediaMimeType,
  type CatalogMediaMimeType,
} from "@/lib/catalog/media/catalog-media-policy";

export type CatalogMediaInspection = Readonly<{
  detectedMimeType: CatalogMediaMimeType;
  byteSize: number;
  width: number;
  height: number;
  checksum: string;
  privacyInspectionPassed: true;
  metadataDisposition: "NO_SENSITIVE_METADATA_DETECTED";
}>;

const FORBIDDEN_TEXT = ["<script", "<html", "<!doctype", "javascript:", "<?xml", "<svg"];

function contentError(code: string, message: string, status = 422): never {
  throw new CatalogPolicyError(code, message, status);
}

function containsForbiddenText(bytes: Buffer): boolean {
  const sample = bytes.toString("latin1").toLocaleLowerCase("en-ZA");
  return FORBIDDEN_TEXT.some((value) => sample.includes(value));
}

function inspectPng(bytes: Buffer): { width: number; height: number } | null {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) return null;
  if (bytes.toString("ascii", 12, 16) !== "IHDR") contentError("CATALOG_MEDIA_PNG_INVALID", "PNG image header is invalid.");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  let offset = 8;
  let endedAt = -1;
  let hasImageData = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const next = offset + 12 + length;
    if (next > bytes.length) contentError("CATALOG_MEDIA_PNG_TRUNCATED", "PNG chunk evidence is incomplete.");
    if (["acTL", "fcTL", "fdAT"].includes(type)) contentError("CATALOG_MEDIA_ANIMATION_UNSUPPORTED", "Animated catalog images are not supported.");
    if (["eXIf", "tEXt", "zTXt", "iTXt"].includes(type)) contentError("CATALOG_MEDIA_METADATA_UNSAFE", "PNG metadata must be removed before upload.");
    if (type === "IHDR" && length !== 13) contentError("CATALOG_MEDIA_PNG_INVALID", "PNG image header length is invalid.");
    if (type === "IDAT" && length > 0) hasImageData = true;
    offset = next;
    if (type === "IEND") { endedAt = next; break; }
  }
  if (endedAt !== bytes.length || !hasImageData) contentError("CATALOG_MEDIA_POLYGLOT_REJECTED", "PNG contains trailing, incomplete or empty image data.");
  return { width, height };
}

const JPEG_SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function inspectJpeg(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  if (bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) contentError("CATALOG_MEDIA_JPEG_TRAILING_DATA", "JPEG must end at its image boundary.");
  let offset = 2;
  let dimensions: { width: number; height: number } | null = null;
  while (offset + 3 < bytes.length) {
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > bytes.length) contentError("CATALOG_MEDIA_JPEG_TRUNCATED", "JPEG segment evidence is incomplete.");
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) contentError("CATALOG_MEDIA_JPEG_TRUNCATED", "JPEG segment evidence is incomplete.");
    if ([0xe1, 0xed, 0xfe].includes(marker)) contentError("CATALOG_MEDIA_METADATA_UNSAFE", "EXIF, XMP, IPTC and comment metadata must be removed before upload.");
    if (JPEG_SOF_MARKERS.has(marker)) {
      if (length < 7) contentError("CATALOG_MEDIA_JPEG_INVALID", "JPEG dimensions are invalid.");
      dimensions = { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  if (!dimensions) contentError("CATALOG_MEDIA_DIMENSIONS_MISSING", "JPEG dimensions could not be derived server-side.");
  return dimensions;
}

function readUInt24LE(bytes: Buffer, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);
}

function inspectWebp(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 30 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") return null;
  if (bytes.readUInt32LE(4) + 8 !== bytes.length) contentError("CATALOG_MEDIA_POLYGLOT_REJECTED", "WebP container length does not match received bytes.");
  let offset = 12;
  let dimensions: { width: number; height: number } | null = null;
  while (offset + 8 <= bytes.length) {
    const type = bytes.toString("ascii", offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;
    const next = data + length + (length % 2);
    if (next > bytes.length) contentError("CATALOG_MEDIA_WEBP_TRUNCATED", "WebP chunk evidence is incomplete.");
    if (["ANIM", "ANMF"].includes(type)) contentError("CATALOG_MEDIA_ANIMATION_UNSUPPORTED", "Animated catalog images are not supported.");
    if (["EXIF", "XMP "].includes(type)) contentError("CATALOG_MEDIA_METADATA_UNSAFE", "WebP EXIF or XMP metadata must be removed before upload.");
    if (type === "VP8X" && length >= 10) {
      const flags = bytes[data] ?? 0;
      if ((flags & 0x02) !== 0) contentError("CATALOG_MEDIA_ANIMATION_UNSUPPORTED", "Animated catalog images are not supported.");
      dimensions = { width: readUInt24LE(bytes, data + 4) + 1, height: readUInt24LE(bytes, data + 7) + 1 };
    } else if (type === "VP8L" && length >= 5 && bytes[data] === 0x2f) {
      const b1 = bytes[data + 1] ?? 0; const b2 = bytes[data + 2] ?? 0; const b3 = bytes[data + 3] ?? 0; const b4 = bytes[data + 4] ?? 0;
      dimensions = { width: 1 + b1 + ((b2 & 0x3f) << 8), height: 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10) };
    } else if (type === "VP8 " && length >= 10 && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
      dimensions = { width: bytes.readUInt16LE(data + 6) & 0x3fff, height: bytes.readUInt16LE(data + 8) & 0x3fff };
    }
    offset = next;
  }
  if (!dimensions) contentError("CATALOG_MEDIA_DIMENSIONS_MISSING", "WebP dimensions could not be derived server-side.");
  return dimensions;
}

export function inspectCatalogMediaContent(input: {
  bytes: Uint8Array;
  declaredMimeType: string;
  declaredByteSize: number;
}): CatalogMediaInspection {
  const bytes = Buffer.from(input.bytes);
  if (bytes.length < 1 || bytes.length > CATALOG_MEDIA_MAX_UPLOAD_BYTES) contentError("CATALOG_MEDIA_SIZE_INVALID", "Received catalog image size is outside the accepted range.", 413);
  if (bytes.length !== input.declaredByteSize) contentError("CATALOG_MEDIA_SIZE_MISMATCH", "Received byte size does not match the upload intent.");
  if (containsForbiddenText(bytes)) contentError("CATALOG_MEDIA_POLYGLOT_REJECTED", "Scriptable or polyglot content is prohibited.");

  const png = inspectPng(bytes);
  const jpeg = png ? null : inspectJpeg(bytes);
  const webp = png || jpeg ? null : inspectWebp(bytes);
  const dimensions = png ?? jpeg ?? webp;
  const detectedMimeType = png ? "image/png" : jpeg ? "image/jpeg" : webp ? "image/webp" : null;
  if (!detectedMimeType || !dimensions || !isCatalogMediaMimeType(detectedMimeType)) contentError("CATALOG_MEDIA_MAGIC_BYTES_INVALID", "File content is not a supported JPEG, PNG or WebP image.", 415);
  if (detectedMimeType !== input.declaredMimeType) contentError("CATALOG_MEDIA_MIME_MISMATCH", "Declared media type does not match server-inspected content.", 415);
  assertCatalogMediaDimensions(dimensions.width, dimensions.height);

  return Object.freeze({
    detectedMimeType,
    byteSize: bytes.length,
    width: dimensions.width,
    height: dimensions.height,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    privacyInspectionPassed: true,
    metadataDisposition: "NO_SENSITIVE_METADATA_DETECTED",
  });
}
