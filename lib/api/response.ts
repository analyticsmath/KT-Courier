import { NextResponse } from "next/server";

// ─── Consistent API response helpers ─────────────────────────────────────────

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function badRequest(message: string, details?: Record<string, string>) {
  return NextResponse.json(
    { error: message, ...(details && { fields: details }) },
    { status: 400 }
  );
}

export function unprocessable(message: string, fields?: Record<string, string>) {
  return NextResponse.json(
    { error: message, ...(fields && { fields }) },
    { status: 422 }
  );
}

export function unauthorized(message = "Authentication required.") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function gone(message = "Resource is no longer available.") {
  return NextResponse.json({ error: message }, { status: 410 });
}

export function forbidden(message = "You do not have permission to perform this action.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Resource not found.") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function serverError(message = "An unexpected error occurred. Please try again.") {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function serviceUnavailable(message = "The service is temporarily unavailable. Please try again.") {
  return NextResponse.json({ error: message }, { status: 503 });
}

export function tooManyRequests(retryAfterSeconds?: number) {
  const headers: Record<string, string> = {};
  if (retryAfterSeconds !== undefined) {
    headers["Retry-After"] = String(retryAfterSeconds);
  }
  return NextResponse.json(
    { error: "Too many requests. Please wait and try again." },
    { status: 429, headers }
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
): NextResponse {
  return NextResponse.json({
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  } satisfies PaginatedResponse<T>);
}

export function parsePagination(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
  skip: number;
} {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "20") || 20)
  );
  return { page, pageSize, skip: (page - 1) * pageSize };
}
