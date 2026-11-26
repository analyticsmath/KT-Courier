import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts, degrees, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { Byte, Encoder } from "@nuintun/qrcode";
import type {
  AnyShipmentDocumentPayload,
  IssuerIdentitySnapshot,
  ShipmentAddressSnapshot,
  ShipmentPodPayload,
  ShipmentWaybillPayload,
} from "./contracts";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;
const BOTTOM_LIMIT = 56;

const COLOR_NAVY = rgb(0.06, 0.13, 0.28);
const COLOR_BLUE = rgb(0.11, 0.28, 0.68);
const COLOR_INK = rgb(0.08, 0.1, 0.14);
const COLOR_MUTED = rgb(0.36, 0.4, 0.47);
const COLOR_BORDER = rgb(0.8, 0.84, 0.9);
const COLOR_SURFACE = rgb(0.96, 0.97, 0.99);
const COLOR_ACCENT_SOFT = rgb(0.92, 0.95, 1);
const COLOR_WHITE = rgb(1, 1, 1);
const COLOR_WATERMARK = rgb(0.84, 0.86, 0.9);
const COLOR_GREEN = rgb(0.07, 0.44, 0.24);
const COLOR_AMBER = rgb(0.6, 0.34, 0.04);

interface LoadedAssets {
  regularFontBytes: Uint8Array | null;
  boldFontBytes: Uint8Array | null;
  monoFontBytes: Uint8Array | null;
  logoPngBytes: Uint8Array | null;
}

let cachedAssets: LoadedAssets | null = null;

function safeReadFile(fullPath: string): Uint8Array | null {
  try {
    if (fs.existsSync(fullPath)) {
      return new Uint8Array(fs.readFileSync(fullPath));
    }
  } catch {
    // Fall back cleanly if asset path is absent in constrained sandboxes.
  }
  return null;
}

function getAssets(): LoadedAssets {
  if (!cachedAssets) {
    cachedAssets = {
      regularFontBytes: safeReadFile(path.join(process.cwd(), "lib", "shipment-documents", "assets", "fonts", "ttf", "DejaVuSans.ttf")),
      boldFontBytes: safeReadFile(path.join(process.cwd(), "lib", "shipment-documents", "assets", "fonts", "ttf", "DejaVuSans-Bold.ttf")),
      monoFontBytes: safeReadFile(path.join(process.cwd(), "lib", "shipment-documents", "assets", "fonts", "ttf", "DejaVuSansMono.ttf")),
      logoPngBytes: safeReadFile(path.join(process.cwd(), "public", "images", "kt-couriers", "brand", "icon-192.png")),
    };
  }
  return cachedAssets;
}

function sanitizePdfText(raw: string | null | undefined, useWinAnsiFallback: boolean): string {
  const cleaned = String(raw ?? "")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  if (!useWinAnsiFallback) return cleaned;
  // Normalize rare symbols only when running without bundled DejaVu TTF fonts.
  return cleaned
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2192/g, "->")
    .replace(/[^\u0020-\u00FF\n]/g, "?");
}

function wrapTextToLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      lines.push("");
      continue;
    }

    const words = trimmed.split(/\s+/);
    let currentLine = "";

    const pushHardBrokenWord = (word: string) => {
      let chunk = "";
      for (const ch of word) {
        const candidate = chunk + ch;
        if (chunk && font.widthOfTextAtSize(candidate, size) > maxWidth) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk = candidate;
        }
      }
      currentLine = chunk;
    };

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) lines.push(currentLine);
        if (font.widthOfTextAtSize(word, size) <= maxWidth) {
          currentLine = word;
        } else {
          pushHardBrokenWord(word);
        }
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

function formatAddressLines(addr: ShipmentAddressSnapshot | null): string[] {
  if (!addr) return ["Address unavailable"];
  const lines: string[] = [];
  if (addr.contactName || addr.contactPhone) {
    lines.push([addr.contactName, addr.contactPhone].filter(Boolean).join(" · "));
  }
  lines.push(addr.line1);
  if (addr.line2) lines.push(addr.line2);
  const locality = [addr.suburb, addr.city, addr.province, addr.postalCode].filter(Boolean).join(", ");
  if (locality) lines.push(locality);
  if (addr.country) lines.push(addr.country);
  return lines;
}

function formatIssuerLines(issuer: IssuerIdentitySnapshot): string[] {
  const lines: string[] = [];
  const title =
    issuer.tradingName && issuer.tradingName !== issuer.legalName
      ? `${issuer.tradingName} (${issuer.legalName})`
      : issuer.legalName;
  lines.push(title);
  const regParts = [
    issuer.registrationNumber ? `Reg: ${issuer.registrationNumber}` : null,
    issuer.vatNumber ? `VAT: ${issuer.vatNumber}` : null,
  ].filter(Boolean);
  if (regParts.length) lines.push(regParts.join(" · "));
  const phones = issuer.telephoneNumbers.join(" / ");
  const contactParts = [
    issuer.supportEmail,
    phones || null,
    issuer.website,
  ].filter(Boolean);
  if (contactParts.length) lines.push(contactParts.join(" · "));
  if (issuer.physicalAddress) {
    lines.push(`Office: ${issuer.physicalAddress}`);
  }
  return lines;
}

interface PdfContext {
  doc: PDFDocument;
  pages: PDFPage[];
  page: PDFPage;
  y: number;
  regular: PDFFont;
  bold: PDFFont;
  mono: PDFFont;
  logo: PDFImage | null;
  fallbackTextMode: boolean;
  documentTitle: string;
  orderNumber: string;
  documentRef: string;
  isSample: boolean;
}

function clean(ctx: PdfContext, value: string | null | undefined): string {
  return sanitizePdfText(value, ctx.fallbackTextMode);
}

function drawWatermarkIfSample(ctx: PdfContext, page: PDFPage) {
  if (!ctx.isSample) return;
  page.drawText(clean(ctx, "SAMPLE FIXTURE - NON-PRODUCTION DOCUMENT"), {
    x: 92,
    y: 300,
    size: 18.5,
    font: ctx.bold,
    color: COLOR_WATERMARK,
    rotate: degrees(32),
    opacity: 0.42,
  });
}

function addNewPage(ctx: PdfContext, continuation: boolean) {
  const page = ctx.doc.addPage([A4_WIDTH, A4_HEIGHT]);
  ctx.pages.push(page);
  ctx.page = page;
  drawWatermarkIfSample(ctx, page);

  if (continuation) {
    page.drawRectangle({
      x: MARGIN,
      y: A4_HEIGHT - 64,
      width: CONTENT_WIDTH,
      height: 26,
      color: COLOR_NAVY,
    });
    page.drawText(
      clean(ctx, `KT COURIERS · ${ctx.documentTitle.toUpperCase()} · ${ctx.orderNumber} (CONTINUED)`),
      {
        x: MARGIN + 10,
        y: A4_HEIGHT - 55,
        size: 9.5,
        font: ctx.bold,
        color: COLOR_WHITE,
      },
    );
    ctx.y = A4_HEIGHT - 82;
  } else {
    ctx.y = A4_HEIGHT - MARGIN;
  }
}

function ensureSpace(ctx: PdfContext, neededHeight: number) {
  if (ctx.y - neededHeight < BOTTOM_LIMIT) {
    addNewPage(ctx, true);
  }
}

function drawHeaderBanner(ctx: PdfContext, subtitle: string, badgeText: string, payload: AnyShipmentDocumentPayload) {
  const topY = ctx.y;
  const issuerLines = formatIssuerLines(payload.issuer);
  const wrappedIssuerLines = issuerLines.flatMap((line) =>
    wrapTextToLines(clean(ctx, line), ctx.regular, 8.2, CONTENT_WIDTH - 28),
  );
  const bannerHeight = Math.max(96, 62 + wrappedIssuerLines.length * 10.5 + 8);

  ctx.page.drawRectangle({
    x: MARGIN,
    y: topY - bannerHeight,
    width: CONTENT_WIDTH,
    height: bannerHeight,
    color: COLOR_NAVY,
  });

  if (ctx.logo) {
    ctx.page.drawRectangle({
      x: MARGIN + 11,
      y: topY - 49,
      width: 38,
      height: 38,
      color: COLOR_WHITE,
      borderColor: rgb(0.76, 0.85, 0.98),
      borderWidth: 0.75,
    });
    ctx.page.drawImage(ctx.logo, {
      x: MARGIN + 14,
      y: topY - 46,
      width: 32,
      height: 32,
    });
  }

  const textX = ctx.logo ? MARGIN + 56 : MARGIN + 14;
  ctx.page.drawText(clean(ctx, ctx.documentTitle.toUpperCase()), {
    x: textX,
    y: topY - 24,
    size: 13.5,
    font: ctx.bold,
    color: COLOR_WHITE,
  });
  ctx.page.drawText(clean(ctx, subtitle), {
    x: textX,
    y: topY - 37,
    size: 8.5,
    font: ctx.regular,
    color: rgb(0.82, 0.88, 0.98),
  });

  // Right-aligned reference & status box inside banner
  const badgeW = 148;
  const badgeX = MARGIN + CONTENT_WIDTH - badgeW - 12;
  ctx.page.drawRectangle({
    x: badgeX,
    y: topY - 52,
    width: badgeW,
    height: 38,
    color: COLOR_BLUE,
    borderColor: rgb(0.45, 0.62, 0.96),
    borderWidth: 0.75,
  });
  ctx.page.drawText(clean(ctx, payload.orderNumber), {
    x: badgeX + 8,
    y: topY - 27,
    size: 10.5,
    font: ctx.mono,
    color: COLOR_WHITE,
  });
  ctx.page.drawText(clean(ctx, badgeText.slice(0, 26)), {
    x: badgeX + 8,
    y: topY - 43,
    size: 7.5,
    font: ctx.bold,
    color: rgb(0.88, 0.93, 1),
  });

  let iy = topY - 58;
  for (const line of wrappedIssuerLines) {
    ctx.page.drawText(line, {
      x: MARGIN + 14,
      y: iy,
      size: 8.2,
      font: ctx.regular,
      color: rgb(0.86, 0.9, 0.96),
    });
    iy -= 10.5;
  }

  ctx.y = topY - bannerHeight - 14;
}

function drawKeyValueRow(
  ctx: PdfContext,
  label: string,
  value: string,
  opts?: { mono?: boolean; highlight?: "green" | "amber" | "navy" },
) {
  const labelW = 148;
  const valueMaxW = CONTENT_WIDTH - labelW - 24;
  const font = opts?.mono ? ctx.mono : ctx.regular;
  const wrapped = wrapTextToLines(clean(ctx, value), font, 9, valueMaxW);
  const rowH = Math.max(16, wrapped.length * 12 + 4);
  ensureSpace(ctx, rowH + 4);

  const rowY = ctx.y;
  ctx.page.drawText(clean(ctx, label), {
    x: MARGIN + 10,
    y: rowY - 11,
    size: 8.5,
    font: ctx.bold,
    color: COLOR_MUTED,
  });

  const valColor =
    opts?.highlight === "green"
      ? COLOR_GREEN
      : opts?.highlight === "amber"
        ? COLOR_AMBER
        : opts?.highlight === "navy"
          ? COLOR_NAVY
          : COLOR_INK;

  let textY = rowY - 11;
  for (const line of wrapped) {
    ctx.page.drawText(line, {
      x: MARGIN + labelW + 10,
      y: textY,
      size: 9,
      font: opts?.highlight ? ctx.bold : font,
      color: valColor,
    });
    textY -= 12;
  }

  ctx.page.drawLine({
    start: { x: MARGIN + 8, y: rowY - rowH },
    end: { x: MARGIN + CONTENT_WIDTH - 8, y: rowY - rowH },
    thickness: 0.4,
    color: COLOR_BORDER,
  });

  ctx.y = rowY - rowH - 2;
}

function drawSectionHeading(ctx: PdfContext, title: string) {
  ensureSpace(ctx, 28);
  const topY = ctx.y;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: topY - 18,
    width: CONTENT_WIDTH,
    height: 18,
    color: COLOR_ACCENT_SOFT,
  });
  ctx.page.drawText(clean(ctx, title.toUpperCase()), {
    x: MARGIN + 8,
    y: topY - 12.5,
    size: 8.5,
    font: ctx.bold,
    color: COLOR_NAVY,
  });
  ctx.y = topY - 22;
}

function drawTwoColumnCards(
  ctx: PdfContext,
  left: { title: string; lines: string[] },
  right: { title: string; lines: string[] },
) {
  const colGap = 12;
  const colW = (CONTENT_WIDTH - colGap) / 2;
  const innerW = colW - 20;

  const leftWrapped = left.lines.flatMap((line) => wrapTextToLines(clean(ctx, line), ctx.regular, 8.8, innerW));
  const rightWrapped = right.lines.flatMap((line) => wrapTextToLines(clean(ctx, line), ctx.regular, 8.8, innerW));
  const maxLines = Math.max(leftWrapped.length, rightWrapped.length, 2);
  const boxH = 30 + maxLines * 11.5;

  ensureSpace(ctx, boxH + 8);
  const topY = ctx.y;

  const renderBox = (x: number, title: string, lines: string[]) => {
    ctx.page.drawRectangle({
      x,
      y: topY - boxH,
      width: colW,
      height: boxH,
      color: COLOR_SURFACE,
      borderColor: COLOR_BORDER,
      borderWidth: 0.75,
    });
    ctx.page.drawText(clean(ctx, title.toUpperCase()), {
      x: x + 10,
      y: topY - 15,
      size: 8.2,
      font: ctx.bold,
      color: COLOR_BLUE,
    });
    let ly = topY - 30;
    for (const line of lines) {
      ctx.page.drawText(line, {
        x: x + 10,
        y: ly,
        size: 8.8,
        font: ctx.regular,
        color: COLOR_INK,
      });
      ly -= 11.5;
    }
  };

  renderBox(MARGIN, left.title, leftWrapped);
  renderBox(MARGIN + colW + colGap, right.title, rightWrapped);
  ctx.y = topY - boxH - 12;
}

function drawQrPanel(ctx: PdfContext, trackingUrl: string, docRef: string, issuedAtSast: string) {
  const qrSizePts = 72;
  const infoW = CONTENT_WIDTH - qrSizePts - 42;
  const urlLines = wrapTextToLines(clean(ctx, trackingUrl), ctx.mono, 7.6, infoW).slice(0, 3);
  const refLines = wrapTextToLines(
    clean(ctx, `Document ref: ${docRef} · Issued: ${issuedAtSast}`),
    ctx.regular,
    7.4,
    infoW,
  ).slice(0, 2);
  const hintLines = wrapTextToLines(
    clean(ctx, "Scan QR or sign in / use recipient tracking share link provided by the sender."),
    ctx.regular,
    7.4,
    infoW,
  ).slice(0, 2);
  const contentHeight = 26 + urlLines.length * 10 + 4 + refLines.length * 10 + hintLines.length * 10 + 8;
  const boxH = Math.max(92, contentHeight);
  ensureSpace(ctx, boxH + 10);
  const topY = ctx.y;

  ctx.page.drawRectangle({
    x: MARGIN,
    y: topY - boxH,
    width: CONTENT_WIDTH,
    height: boxH,
    color: COLOR_WHITE,
    borderColor: COLOR_BORDER,
    borderWidth: 0.75,
  });

  // Render crisp vector QR matrix with quiet zone
  const qrX = MARGIN + 12;
  const qrY = topY - Math.round((boxH - qrSizePts) / 2) - qrSizePts;
  try {
    const encoded = new Encoder({ level: "M" }).encode(new Byte(trackingUrl));
    const quiet = 2;
    const totalModules = encoded.size + quiet * 2;
    const mod = qrSizePts / totalModules;
    ctx.page.drawRectangle({ x: qrX, y: qrY, width: qrSizePts, height: qrSizePts, color: COLOR_WHITE });
    for (let row = 0; row < encoded.size; row++) {
      for (let col = 0; col < encoded.size; col++) {
        if (encoded.get(col, row) === 1) {
          ctx.page.drawRectangle({
            x: qrX + (col + quiet) * mod,
            y: qrY + qrSizePts - (row + quiet + 1) * mod,
            width: mod + 0.08,
            height: mod + 0.08,
            color: COLOR_INK,
          });
        }
      }
    }
  } catch {
    ctx.page.drawRectangle({
      x: qrX,
      y: qrY,
      width: qrSizePts,
      height: qrSizePts,
      borderColor: COLOR_BORDER,
      borderWidth: 1,
    });
  }

  const infoX = qrX + qrSizePts + 16;
  ctx.page.drawText(clean(ctx, "ONLINE SHIPMENT TRACKING & VERIFICATION"), {
    x: infoX,
    y: topY - 19,
    size: 8.5,
    font: ctx.bold,
    color: COLOR_NAVY,
  });
  let uy = topY - 33;
  for (const line of urlLines) {
    ctx.page.drawText(line, { x: infoX, y: uy, size: 7.6, font: ctx.mono, color: COLOR_BLUE });
    uy -= 10;
  }
  uy -= 3;
  for (const line of refLines) {
    ctx.page.drawText(line, {
      x: infoX,
      y: uy,
      size: 7.4,
      font: ctx.regular,
      color: COLOR_MUTED,
    });
    uy -= 10;
  }
  for (const line of hintLines) {
    ctx.page.drawText(line, {
      x: infoX,
      y: uy,
      size: 7.4,
      font: ctx.regular,
      color: COLOR_MUTED,
    });
    uy -= 10;
  }

  ctx.y = topY - boxH - 12;
}

function finalizeFooters(ctx: PdfContext) {
  const total = ctx.pages.length;
  for (let idx = 0; idx < total; idx++) {
    const p = ctx.pages[idx]!;
    p.drawLine({
      start: { x: MARGIN, y: 40 },
      end: { x: MARGIN + CONTENT_WIDTH, y: 40 },
      thickness: 0.6,
      color: COLOR_BORDER,
    });
    p.drawText(clean(ctx, `${ctx.documentTitle} · ${ctx.documentRef} · Order ${ctx.orderNumber}`), {
      x: MARGIN,
      y: 26,
      size: 7.5,
      font: ctx.regular,
      color: COLOR_MUTED,
    });
    const pageLabel = `Page ${idx + 1} of ${total}`;
    const labelW = ctx.bold.widthOfTextAtSize(pageLabel, 7.5);
    p.drawText(pageLabel, {
      x: MARGIN + CONTENT_WIDTH - labelW,
      y: 26,
      size: 7.5,
      font: ctx.bold,
      color: COLOR_NAVY,
    });
  }
}

async function createPdfContext(payload: AnyShipmentDocumentPayload, title: string): Promise<PdfContext> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${title} — ${payload.orderNumber}`);
  doc.setSubject(`KT Couriers ${payload.kind} ${payload.documentRef}`);
  doc.setCreator("KT Couriers Document Engine (kt-pdf-v1)");
  doc.setProducer("KT Couriers (Pty) Ltd");
  doc.setCreationDate(new Date(payload.issuedAtIso));

  const assets = getAssets();
  let regular: PDFFont;
  let bold: PDFFont;
  let mono: PDFFont;
  let fallbackTextMode = false;

  if (assets.regularFontBytes && assets.boldFontBytes && assets.monoFontBytes) {
    doc.registerFontkit(fontkit);
    regular = await doc.embedFont(assets.regularFontBytes, { subset: true });
    bold = await doc.embedFont(assets.boldFontBytes, { subset: true });
    mono = await doc.embedFont(assets.monoFontBytes, { subset: true });
  } else {
    fallbackTextMode = true;
    regular = await doc.embedFont(StandardFonts.Helvetica);
    bold = await doc.embedFont(StandardFonts.HelveticaBold);
    mono = await doc.embedFont(StandardFonts.Courier);
  }

  let logo: PDFImage | null = null;
  if (assets.logoPngBytes) {
    try {
      logo = await doc.embedPng(assets.logoPngBytes);
    } catch {
      logo = null;
    }
  }

  const ctx: PdfContext = {
    doc,
    pages: [],
    page: undefined as unknown as PDFPage,
    y: A4_HEIGHT - MARGIN,
    regular,
    bold,
    mono,
    logo,
    fallbackTextMode,
    documentTitle: title,
    orderNumber: payload.orderNumber,
    documentRef: payload.documentRef,
    isSample: Boolean(payload.isSample),
  };

  addNewPage(ctx, false);
  return ctx;
}

function renderWaybillContent(ctx: PdfContext, payload: ShipmentWaybillPayload) {
  drawHeaderBanner(
    ctx,
    payload.issuer.vatNumber
      ? "Commercial Shipment Waybill · Valid for collection & transit"
      : "Shipment Waybill · Non-VAT commercial consignment record",
    payload.statusLabel,
    payload,
  );

  drawSectionHeading(ctx, "Consignment & Booking Summary");
  drawKeyValueRow(ctx, "Order reference", `${payload.orderNumber} (Rev ${payload.revision})`, { mono: true, highlight: "navy" });
  drawKeyValueRow(ctx, "Document reference", payload.documentRef, { mono: true });
  const serviceDisplay =
    payload.serviceName && payload.serviceName !== payload.deliveryTypeLabel
      ? `${payload.deliveryTypeLabel} · ${payload.serviceName}`
      : payload.deliveryTypeLabel;
  drawKeyValueRow(ctx, "Service & source", `${serviceDisplay} (${payload.orderSource})`);
  drawKeyValueRow(ctx, "Booked timestamp", payload.createdAtSast);
  if (payload.confirmedAtSast) drawKeyValueRow(ctx, "Confirmed timestamp", payload.confirmedAtSast);
  if (payload.scheduledForSast) drawKeyValueRow(ctx, "Scheduled window", payload.scheduledForSast);
  if (payload.routeDistanceKm) drawKeyValueRow(ctx, "Verified route distance", `${payload.routeDistanceKm} km`);
  drawKeyValueRow(ctx, "Consignment count", `${payload.parcelCount} parcel${payload.parcelCount === 1 ? "" : "s"}`);
  if (payload.parcelSize || payload.parcelClassMaxWeightKg) {
    const classParts = [
      payload.parcelSize ? `Class: ${payload.parcelSize}` : null,
      payload.parcelClassMaxWeightKg ? `Class limit: up to ${payload.parcelClassMaxWeightKg} kg` : null,
    ].filter(Boolean);
    drawKeyValueRow(ctx, "Parcel classification", classParts.join(" · "));
  }
  if (payload.actualWeightKg) drawKeyValueRow(ctx, "Declared weight", `${payload.actualWeightKg} kg`);
  if (payload.dimensionsCm) drawKeyValueRow(ctx, "Declared dimensions", payload.dimensionsCm);
  drawKeyValueRow(ctx, "Parcel description", payload.parcelDescription ?? "General parcel consignment");
  if (payload.customerNote) drawKeyValueRow(ctx, "Booking note", payload.customerNote);

  ctx.y -= 6;
  drawTwoColumnCards(
    ctx,
    {
      title: "Collection / Sender",
      lines: [
        `Account / Sender: ${payload.senderDisplayName}`,
        ...(payload.senderEmailMaskedOrSafe ? [`Email: ${payload.senderEmailMaskedOrSafe}`] : []),
        ...formatAddressLines(payload.pickup),
      ],
    },
    {
      title: "Destination / Recipient",
      lines: [
        `Recipient: ${payload.recipientName}`,
        ...(payload.recipientPhone ? [`Contact: ${payload.recipientPhone}`] : []),
        ...formatAddressLines(payload.dropoff),
      ],
    },
  );

  drawSectionHeading(ctx, "Payment & Collection Terms");
  drawKeyValueRow(ctx, "Payment method", payload.paymentSummary.modeLabel);
  drawKeyValueRow(ctx, "Settlement status", payload.paymentSummary.paymentStateLabel, {
    highlight: payload.paymentSummary.cashDueOnDeliveryZar && Number(payload.paymentSummary.cashDueOnDeliveryZar) > 0 ? "amber" : "green",
  });
  if (payload.paymentSummary.totalZar !== null) {
    drawKeyValueRow(ctx, "Total tariff", `${payload.paymentSummary.currency} ${payload.paymentSummary.totalZar}`, { mono: true });
  }
  if (payload.paymentSummary.depositPaidZar !== null) {
    drawKeyValueRow(ctx, "Paid / deposit online", `${payload.paymentSummary.currency} ${payload.paymentSummary.depositPaidZar}`, { mono: true });
  }
  if (payload.paymentSummary.cashDueOnDeliveryZar !== null) {
    drawKeyValueRow(
      ctx,
      "Cash due at delivery",
      `${payload.paymentSummary.currency} ${payload.paymentSummary.cashDueOnDeliveryZar}`,
      {
        mono: true,
        highlight: Number(payload.paymentSummary.cashDueOnDeliveryZar) > 0 ? "amber" : undefined,
      },
    );
  }

  ctx.y -= 6;
  drawQrPanel(ctx, payload.trackingUrl, payload.documentRef, payload.issuedAtSast);

  // Blank handover boxes for physical dispatch ONLY — never prefilled signatures.
  drawTwoColumnCards(
    ctx,
    {
      title: "Physical Pickup Handover (Blank)",
      lines: [
        "Driver Name: _______________________",
        "Date/Time: _______________  Sign: ___________",
      ],
    },
    {
      title: "Physical Recipient Receipt (Blank)",
      lines: [
        "Recipient Full Name: ___________________",
        "Date/Time: _______________  Sign: ___________",
      ],
    },
  );
}

function renderPodContent(ctx: PdfContext, payload: ShipmentPodPayload) {
  drawHeaderBanner(
    ctx,
    "Official Proof of Delivery Record",
    payload.proofMethod === "OTP" ? "OTP VERIFIED" : "ADMIN MANUAL POD",
    payload,
  );

  drawSectionHeading(ctx, "Delivery Verification Evidence");
  drawKeyValueRow(ctx, "Order reference", `${payload.orderNumber} (Rev ${payload.revision})`, { mono: true, highlight: "navy" });
  drawKeyValueRow(ctx, "POD document ref", payload.documentRef, { mono: true });
  drawKeyValueRow(ctx, "Verification method", payload.proofMethodLabel, {
    highlight: payload.proofMethod === "OTP" ? "green" : "amber",
  });
  drawKeyValueRow(ctx, "Integrity note", payload.verificationSummary);
  drawKeyValueRow(ctx, "Delivered timestamp", payload.deliveredAtSast, { highlight: "green" });
  if (payload.otpVerifiedAtSast) {
    drawKeyValueRow(ctx, "OTP verified at", payload.otpVerifiedAtSast);
  }
  drawKeyValueRow(ctx, "Recipient name", payload.recipientName);
  if (payload.recipientPhone) {
    drawKeyValueRow(ctx, "Recipient contact", payload.recipientPhone);
  }
  drawKeyValueRow(ctx, "Delivered by", payload.driverDisplay);
  drawKeyValueRow(ctx, "Consignment count", `${payload.parcelCount} parcel${payload.parcelCount === 1 ? "" : "s"}`);
  drawKeyValueRow(ctx, "Parcel description", payload.parcelDescription ?? "General parcel consignment");
  if (payload.publicNote) {
    drawKeyValueRow(ctx, "Delivery note", payload.publicNote);
  }
  if (payload.privateMediaNotice) {
    drawKeyValueRow(ctx, "Supporting evidence", payload.privateMediaNotice);
  }

  ctx.y -= 6;
  drawTwoColumnCards(
    ctx,
    {
      title: "Collection Origin",
      lines: [
        payload.pickupAreaSummary ?? "Confirmed sender collection point",
        `Service: ${payload.deliveryTypeLabel}`,
      ],
    },
    {
      title: "Delivery Destination",
      lines: formatAddressLines(payload.dropoffAddress),
    },
  );

  drawQrPanel(ctx, payload.trackingUrl, payload.documentRef, payload.issuedAtSast);
}

export async function renderShipmentDocumentPdf(payload: AnyShipmentDocumentPayload): Promise<Uint8Array> {
  const title = payload.kind === "WAYBILL" ? "Official Waybill" : "Proof of Delivery";
  const ctx = await createPdfContext(payload, title);

  if (payload.kind === "WAYBILL") {
    renderWaybillContent(ctx, payload);
  } else {
    renderPodContent(ctx, payload);
  }

  finalizeFooters(ctx);
  return ctx.doc.save();
}
