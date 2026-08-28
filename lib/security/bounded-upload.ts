import { NextResponse, type NextRequest } from "next/server";

export interface BoundedUploadOptions {
  maxSizeBytes: number;
  allowedMimeTypes?: readonly string[];
  maxFiles?: number;
}

export interface BoundedFile {
  name: string;
  sanitizedName: string;
  type: string;
  size: number;
  bytes: Uint8Array;
}

export interface BoundedUploadResult {
  fields: Record<string, string>;
  files: Record<string, BoundedFile>;
}

export class BoundedUploadError extends Error {
  constructor(
    public readonly code: "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE" | "INVALID_MULTIPART" | "EMPTY_PAYLOAD",
    message: string,
    public readonly status = 413,
  ) {
    super(message);
    this.name = "BoundedUploadError";
  }
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/^(\.\.[/\\])+/, "..")
    .replace(/[/\\]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 180);
}

/**
 * Parses multipart form data with strict request-time bounded resource consumption.
 * Validates Content-Length before full buffering and enforces file limits and MIME restrictions.
 */
export async function parseBoundedMultipartRequest(
  request: NextRequest,
  options: BoundedUploadOptions,
): Promise<{ result: BoundedUploadResult; errorResponse?: never } | { result?: never; errorResponse: NextResponse }> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    const parsed = parseInt(declaredLength, 10);
    if (isNaN(parsed) || parsed > options.maxSizeBytes) {
      return {
        errorResponse: NextResponse.json(
          { error: "Upload request body exceeds maximum allowed size.", code: "PAYLOAD_TOO_LARGE" },
          { status: 413 },
        ),
      };
    }
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return {
      errorResponse: NextResponse.json(
        { error: "A multipart/form-data request is required.", code: "INVALID_MULTIPART" },
        { status: 415 },
      ),
    };
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return {
      errorResponse: NextResponse.json(
        { error: "Multipart form data could not be parsed.", code: "INVALID_MULTIPART" },
        { status: 422 },
      ),
    };
  }

  const fields: Record<string, string> = {};
  const files: Record<string, BoundedFile> = {};
  let totalBytes = 0;
  let fileCount = 0;
  const maxFiles = options.maxFiles ?? 5;

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      fields[key] = value;
    } else if (value instanceof File) {
      fileCount += 1;
      if (fileCount > maxFiles) {
        return {
          errorResponse: NextResponse.json(
            { error: `Maximum of ${maxFiles} files allowed per upload.`, code: "PAYLOAD_TOO_LARGE" },
            { status: 413 },
          ),
        };
      }

      if (value.size > options.maxSizeBytes) {
        return {
          errorResponse: NextResponse.json(
            { error: `File '${value.name}' exceeds maximum size limit.`, code: "PAYLOAD_TOO_LARGE" },
            { status: 413 },
          ),
        };
      }

      totalBytes += value.size;
      if (totalBytes > options.maxSizeBytes) {
        return {
          errorResponse: NextResponse.json(
            { error: "Total upload size exceeds maximum allowed limit.", code: "PAYLOAD_TOO_LARGE" },
            { status: 413 },
          ),
        };
      }

      if (options.allowedMimeTypes && options.allowedMimeTypes.length > 0) {
        const normalizedMime = value.type.toLowerCase().trim();
        const allowed = options.allowedMimeTypes.some((allowedType) =>
          allowedType.endsWith("/*")
            ? normalizedMime.startsWith(allowedType.slice(0, -1))
            : normalizedMime === allowedType.toLowerCase(),
        );

        if (!allowed) {
          return {
            errorResponse: NextResponse.json(
              { error: `File type '${value.type}' is not supported.`, code: "UNSUPPORTED_MEDIA_TYPE" },
              { status: 415 },
            ),
          };
        }
      }

      const buffer = await value.arrayBuffer();
      files[key] = {
        name: value.name,
        sanitizedName: sanitizeFilename(value.name || "upload"),
        type: value.type,
        size: value.size,
        bytes: new Uint8Array(buffer),
      };
    }
  }

  return {
    result: { fields, files },
  };
}
