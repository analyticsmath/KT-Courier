// ─── Shared branded email layout ─────────────────────────────────────────────
// All transactional emails share this layout. Clean, white, mobile-readable.
// No external images. No dark/neon style. No unverifiable guarantees.

interface LayoutOptions {
  title: string;
  body: string;       // pre-rendered inner HTML
  actionUrl?: string;
  actionLabel?: string;
}

const BRAND_NAVY = "#0F2B52";
const BRAND_BLUE = "#1D6ADB";

export function renderEmailHtml(opts: LayoutOptions): string {
  const actionBlock = opts.actionUrl
    ? `
    <div style="text-align:center;margin:32px 0;">
      <a href="${opts.actionUrl}"
         style="display:inline-block;padding:12px 28px;background:${BRAND_BLUE};
                color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:600;
                border-radius:8px;text-decoration:none;">
        ${opts.actionLabel ?? "View"}
      </a>
    </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;
                      overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:${BRAND_NAVY};padding:24px 32px;">
              <span style="font-size:20px;font-weight:700;color:#ffffff;
                           letter-spacing:-0.3px;">KT Couriers</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 8px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;
                         color:#0a1628;line-height:1.3;">${opts.title}</h1>
              <div style="font-size:15px;color:#374151;line-height:1.7;">
                ${opts.body}
              </div>
              ${actionBlock}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px 32px;border-top:1px solid #e5e7eb;margin-top:24px;">
              <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;line-height:1.6;">
                You received this email because of activity on your KT Couriers account
                or delivery request.
              </p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                &copy; KT Couriers &middot; Cape Town, South Africa
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderEmailText(title: string, body: string, actionUrl?: string): string {
  const lines = [
    "KT Couriers",
    "====================",
    "",
    title,
    "--------------------",
    "",
    body
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim(),
    "",
  ];

  if (actionUrl) {
    lines.push(actionUrl, "");
  }

  lines.push(
    "--------------------",
    "You received this email because of activity on your KT Couriers account or delivery request.",
    "© KT Couriers · Cape Town, South Africa"
  );

  return lines.join("\n");
}
