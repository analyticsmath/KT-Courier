// Shared KT Couriers email presentation. Business events, recipients and delivery
// remain owned by lib/notifications; this module has no sending side effects.
export interface CompanyBrandSnapshot {
  legalName?: string | null;
  tradingName?: string | null;
  registrationNumber?: string | null;
  vatNumber?: string | null;
  physicalAddress?: {
    line1?: string;
    line2?: string | null;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  } | null;
  supportEmail?: string | null;
  telephoneNumbers?: readonly string[] | null;
  website?: string | null;
}

export interface LayoutOptions {
  title: string;
  /** Trusted, pre-rendered HTML. Escape dynamic values before inserting them. */
  body: string;
  actionUrl?: string;
  actionLabel?: string;
  preheader?: string;
  brand?: CompanyBrandSnapshot | null;
}

const PUBLIC_SITE = "https://www.ktcouriers.com";
const LOGO_URL = `${PUBLIC_SITE}/images/kt-couriers/brand/icon-192.png`;
const COLORS = {
  ink: "#191919",
  muted: "#595959",
  surface: "#F4F4F4",
  white: "#FFFFFF",
  line: "#E2E2E2",
  action: "#982C35",
};

export function escapeEmailHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Transactional links may only lead to the verified business site or its
 * explicitly configured application origin (for legitimate staging resets).
 * Never turn a user-controlled URL into a branded phishing CTA. */
function trustedEmailUrl(value: string): string {
  if (/^[\s]*\/\//.test(value) || /[\r\n]/.test(value)) throw new Error("UNSAFE_EMAIL_ACTION_URL");
  const url = new URL(value, PUBLIC_SITE);
  let configuredHost = "";
  try {
    configuredHost = new URL(process.env.NEXT_PUBLIC_APP_URL || PUBLIC_SITE).hostname;
  } catch { /* default to canonical site */ }
  const allowedHosts = new Set(["www.ktcouriers.com", "ktcouriers.com", configuredHost]);
  if (!allowedHosts.has(url.hostname) || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
    throw new Error("UNSAFE_EMAIL_ACTION_URL");
  }
  return url.toString();
}

export function renderEmailHtml(opts: LayoutOptions): string {
  const brand = opts.brand;
  const brandName = brand?.tradingName || brand?.legalName || "KT Couriers";
  const title = escapeEmailHtml(opts.title);
  const safeName = escapeEmailHtml(brandName);
  const preheader = escapeEmailHtml(opts.preheader || opts.title);
  const actionUrl = opts.actionUrl ? escapeEmailHtml(trustedEmailUrl(opts.actionUrl)) : null;
  const actionLabel = escapeEmailHtml(opts.actionLabel || "View details");
  const support = brand?.supportEmail && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(brand.supportEmail) ? brand.supportEmail : null;
  const reg = brand?.registrationNumber ? `<span>Registration: ${escapeEmailHtml(brand.registrationNumber)}</span>` : "";
  const vat = brand?.vatNumber ? `<span style="padding-left:12px;">VAT: ${escapeEmailHtml(brand.vatNumber)}</span>` : "";
  const action = actionUrl ? `
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;margin-bottom:28px;">
                  <tr><td bgcolor="${COLORS.action}" style="background-color:${COLORS.action};">
                    <a href="${actionUrl}" style="display:inline-block;padding:16px 25px;color:#FFFFFF;background-color:${COLORS.action};font-size:15px;line-height:20px;font-weight:700;text-decoration:none;min-height:20px;">${actionLabel} &rarr;</a>
                  </td></tr>
                </table>` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>${title}</title>
  <style>
    @media screen and (max-width:620px) {
      .email-shell { width:100% !important; }
      .email-gutter { padding-left:24px !important; padding-right:24px !important; }
      .email-title { font-size:29px !important; line-height:35px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.surface};color:${COLORS.ink};font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.surface}" style="width:100%;background-color:${COLORS.surface};border-collapse:collapse;">
    <tr><td align="center" style="padding:32px 12px;">
      <!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->
      <table role="presentation" class="email-shell" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.white}" style="width:100%;max-width:600px;background-color:${COLORS.white};border-collapse:collapse;">
        <tr><td class="email-gutter" style="padding:28px 44px 26px;border-bottom:1px solid ${COLORS.line};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="58" valign="middle" style="width:58px;">
                <img src="${LOGO_URL}" width="48" height="48" alt="KT Couriers" style="display:block;width:48px;height:48px;max-width:48px;border:0;object-fit:contain;">
              </td>
              <td valign="middle" style="font-size:19px;line-height:24px;font-weight:800;letter-spacing:-0.5px;color:${COLORS.ink};">KT COURIERS</td>
            </tr>
          </table>
        </td></tr>
        <tr><td class="email-gutter" style="padding:44px 44px 38px;">
          <h1 class="email-title" style="margin:0 0 23px;font-family:Arial,Helvetica,sans-serif;font-size:34px;line-height:40px;font-weight:700;letter-spacing:-1px;color:${COLORS.ink};">${title}</h1>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:${COLORS.ink};">${opts.body}</div>
          ${action}
          <p style="margin:32px 0 0;padding:22px 0 0;border-top:1px solid ${COLORS.line};font-size:13px;line-height:22px;color:${COLORS.muted};">Need an update? <a href="${PUBLIC_SITE}/track" style="color:${COLORS.action};text-decoration:underline;">Track a parcel</a> or <a href="${PUBLIC_SITE}/contact" style="color:${COLORS.action};text-decoration:underline;">contact our team</a>.</p>
        </td></tr>
        <tr><td class="email-gutter" bgcolor="${COLORS.ink}" style="padding:30px 44px;background-color:${COLORS.ink};">
          <p style="margin:0 0 12px;color:#FFFFFF;font-size:16px;font-weight:700;line-height:22px;">From checkout to doorstep.</p>
          <p style="margin:0 0 12px;color:#E8E8E8;font-size:12px;line-height:19px;">This is a service email relating to your ${safeName} account, order or delivery. No promotional subscription is required to receive essential service updates.</p>
          <p style="margin:0;color:#E8E8E8;font-size:12px;line-height:19px;">&copy; ${new Date().getFullYear()} ${safeName} · South Africa ${reg} ${vat}${support ? `<br>Support: <a href="mailto:${escapeEmailHtml(support)}" style="color:#FFFFFF;">${escapeEmailHtml(support)}</a>` : ""}</p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
}

/** The same verified, escaped notification content gets a polished HTML view
 * at the delivery boundary; the immutable stored plain-text receipt is retained. */
export function renderCanonicalEmail(opts: { title: string; body: string; actionRoute?: string | null }): string {
  const paragraphs = opts.body.split(/\n\s*\n/).filter(Boolean).map((paragraph) =>
    `<p style="margin:0 0 16px;">${escapeEmailHtml(paragraph).replace(/\n/g, "<br>")}</p>`
  ).join("");
  const trackingFallback = /(?:delivery|parcel|courier booking|marketplace order)/i.test(opts.title) ? "/track" : undefined;
  const actionUrl = opts.actionRoute || trackingFallback;
  return renderEmailHtml({
    title: opts.title,
    body: paragraphs,
    actionUrl,
    actionLabel: actionUrl === "/track" ? "Track your delivery" : "View details",
    preheader: opts.body.slice(0, 130),
  });
}

export function renderEmailText(title: string, body: string, actionUrl?: string, brand?: CompanyBrandSnapshot | null): string {
  const name = brand?.tradingName || brand?.legalName || "KT Couriers";
  const location = brand?.physicalAddress?.city
    ? `${brand.physicalAddress.city}, ${brand.physicalAddress.country || "South Africa"}`
    : "South Africa";
  const lines = [
    name, "====================", "", title, "--------------------", "",
    body.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim(), "",
  ];
  if (actionUrl) lines.push(actionUrl, "");
  lines.push("--------------------", `You received this email because of activity on your ${name} account or delivery request.`, `© ${name} · ${location}`);
  if (brand?.registrationNumber) lines.push(`Reg: ${brand.registrationNumber}`);
  if (brand?.supportEmail) lines.push(`Support: ${brand.supportEmail}`);
  return lines.join("\n");
}
