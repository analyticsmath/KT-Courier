/**
 * KT Couriers transactional email design system.
 * Email-client-safe table layout; no scripts, web fonts, or remote CSS.
 * Business HTML is pre-rendered by trusted templates; plain text is escaped separately.
 */
export interface CompanyBrandSnapshot {
  legalName?: string | null;
  tradingName?: string | null;
  registrationNumber?: string | null;
  vatNumber?: string | null;
  physicalAddress?: { line1?: string; line2?: string | null; city?: string; province?: string; postalCode?: string; country?: string } | null;
  supportEmail?: string | null;
  telephoneNumbers?: readonly string[] | null;
  website?: string | null;
}
export interface LayoutOptions {
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
  brand?: CompanyBrandSnapshot | null;
}
const NAVY = "#102943";
const BLUE = "#1769E0";
const INK = "#15263B";
const WEBSITE = "https://www.ktcouriers.com";
const LOGO = WEBSITE + "/images/kt-couriers/brand/icon-192.png";
export function escapeEmailHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function safeUrl(value?: string): string | undefined {
  if (!value || value.startsWith("//")) return undefined;
  try {
    const url = new URL(value, WEBSITE);
    if (url.protocol !== "https:" || url.username || url.password || /[\r\n]/.test(value)) return undefined;
    return url.toString();
  } catch { return undefined; }
}
/** Transform notification-authority plain text into readable, escaped HTML. */
export function renderPlainTextNotification(title: string, body: string): string {
  const paragraphs = body.split(/\n\s*\n/).filter(Boolean).map(part =>
    '<p style="margin:0 0 18px;">' + escapeEmailHtml(part).replace(/\n/g, "<br>") + "</p>"
  ).join("");
  return renderEmailHtml({ title, body: paragraphs });
}
export function renderEmailHtml(opts: LayoutOptions): string {
  const brandName = opts.brand?.tradingName || opts.brand?.legalName || "KT Couriers";
  const location = opts.brand?.physicalAddress?.city
    ? opts.brand.physicalAddress.city + ", " + (opts.brand.physicalAddress.country || "South Africa")
    : "South Africa";
  const target = safeUrl(opts.actionUrl);
  const action = target ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 10px;"><tr><td bgcolor="${BLUE}" style="border-radius:6px;background:${BLUE};"><a href="${escapeEmailHtml(target)}" style="display:inline-block;padding:15px 26px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;">${escapeEmailHtml(opts.actionLabel || "View details")} &rarr;</a></td></tr></table>` : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeEmailHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#EDF2F7;color:${INK};font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;font-size:1px;color:#EDF2F7;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">An update from KT Couriers — deliveries, made clearer.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#EDF2F7" style="background:#EDF2F7;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;">
<tr><td style="background:${NAVY};padding:26px 34px;border-radius:10px 10px 0 0;border-bottom:4px solid ${BLUE};">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:middle;padding-right:14px;"><img src="${LOGO}" width="52" height="52" alt="" style="display:block;width:52px;height:52px;border:0;"></td><td style="vertical-align:middle;font-size:23px;letter-spacing:-.4px;font-weight:700;color:#ffffff;">KT Couriers</td></tr></table>
<div style="color:#C7D7EA;font-size:11px;letter-spacing:1px;line-height:20px;margin-top:12px;">DELIVERING WHAT MATTERS</div></td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:44px 36px 38px;">
<h1 style="font-family:Arial,sans-serif;margin:0 0 20px;color:${NAVY};font-size:28px;line-height:1.22;font-weight:700;letter-spacing:-.5px;">${escapeEmailHtml(opts.title)}</h1>
<div style="color:#33465C;font-size:15px;line-height:1.75;">${opts.body}</div>
${action}
</td></tr>
<tr><td bgcolor="#F7F9FC" style="background:#F7F9FC;padding:28px 36px;border-top:1px solid #E4EAF1;border-radius:0 0 10px 10px;">
<p style="margin:0 0 12px;color:${NAVY};font-size:13px;font-weight:700;">KT Couriers <span style="font-weight:400;color:#60748B;">&middot; Delivering what matters.</span></p>
<p style="margin:0 0 12px;color:#60748B;font-size:12px;line-height:19px;">This is a service message about your account, purchase or delivery. Never share a verification code with someone who contacts you unexpectedly.</p>
<p style="margin:0;color:#60748B;font-size:12px;line-height:19px;"><a href="${WEBSITE}" style="color:${BLUE};text-decoration:underline;">Website</a> &nbsp;&middot;&nbsp; <a href="${WEBSITE}/track" style="color:${BLUE};text-decoration:underline;">Track a delivery</a>${opts.brand?.supportEmail ? ` &nbsp;&middot;&nbsp; <a href="mailto:${escapeEmailHtml(opts.brand.supportEmail)}" style="color:${BLUE};text-decoration:underline;">Support</a>` : ""}<br>${escapeEmailHtml(location)}${opts.brand?.registrationNumber ? ` &middot; Reg: ${escapeEmailHtml(opts.brand.registrationNumber)}` : ""}</p>
</td></tr></table></td></tr></table></body></html>`;
}
export function renderEmailText(title: string, body: string, actionUrl?: string, brand?: CompanyBrandSnapshot | null): string {
  const brandName = brand?.tradingName || brand?.legalName || "KT Couriers";
  const lines = [brandName, "Delivering what matters.", "", title, "", body.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim(), ""];
  const link = safeUrl(actionUrl);
  if (link) lines.push(link, "");
  lines.push("You received this service message due to account, order or delivery activity.", WEBSITE);
  return lines.join("\n");
}
