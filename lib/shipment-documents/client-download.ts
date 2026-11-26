"use client";

export interface PdfDownloadFailure {
  ok: false;
  message: string;
  code?: string;
  actionHref?: string;
}

export interface PdfDownloadSuccess {
  ok: true;
  documentRef: string | null;
}

/**
 * Fetches an authenticated PDF via same-origin cookies and verifies both HTTP
 * status and `%PDF-` binary signature before saving, so JSON error responses
 * (403/409/429/503) never download as corrupt `.pdf` files.
 */
export async function downloadAuthorizedPdfBlob(
  href: string,
  fileName: string,
): Promise<PdfDownloadSuccess | PdfDownloadFailure> {
  try {
    const res = await fetch(href, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
    if (!res.ok || !contentType.includes("application/pdf")) {
      const errorBody = (await res.json().catch(() => null)) as {
        error?: string;
        code?: string;
        actionHref?: string;
      } | null;
      return {
        ok: false,
        message:
          errorBody?.error ??
          "Official PDF document could not be downloaded right now. Please try again.",
        code: errorBody?.code,
        actionHref: errorBody?.actionHref,
      };
    }

    const blob = await res.blob();
    const signature = await blob.slice(0, 5).text();
    if (signature !== "%PDF-") {
      return {
        ok: false,
        message: "The server response was not a valid PDF binary.",
      };
    }

    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);

    return {
      ok: true,
      documentRef: res.headers.get("x-kt-document-ref"),
    };
  } catch {
    return {
      ok: false,
      message: "Network interruption while downloading the PDF. Please retry.",
    };
  }
}
