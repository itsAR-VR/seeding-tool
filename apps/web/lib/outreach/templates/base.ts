/**
 * Base HTML email template with inline CSS.
 *
 * Design constraints:
 * - ALL CSS must be inline (email clients strip <style> tags)
 * - Images must be URLs, never data URIs (Gmail 102KB clip limit)
 * - Total template HTML should stay under 50KB to leave room for body content
 * - Visible unsubscribe link in footer (CAN-SPAM compliance)
 */

import { escapeHtml } from "@/lib/outreach/html-escape";

export type BaseTemplateParams = {
  /** Pre-escaped HTML body content (the main message) */
  readonly bodyContent: string;
  /** Brand name for the header */
  readonly brandName: string;
  /** Optional brand logo URL (must be https) */
  readonly logoUrl?: string;
  /** Optional product image URL (must be https) */
  readonly productImageUrl?: string;
  /** Optional product image alt text */
  readonly productImageAlt?: string;
  /** Optional CTA button text */
  readonly ctaText?: string;
  /** Optional CTA button URL */
  readonly ctaUrl?: string;
  /** Unsubscribe URL (pre-built, not user content) */
  readonly unsubscribeUrl: string;
};

/**
 * Render the base HTML email template.
 *
 * All dynamic string values (brandName, ctaText, productImageAlt) are
 * HTML-escaped inside this function. The `bodyContent` parameter is
 * expected to already be escaped by the caller.
 */
export function renderBaseTemplate(params: BaseTemplateParams): string {
  const safeBrandName = escapeHtml(params.brandName);
  const safeCta = params.ctaText ? escapeHtml(params.ctaText) : "";
  const safeAlt = params.productImageAlt
    ? escapeHtml(params.productImageAlt)
    : "Product image";

  const logoBlock = params.logoUrl
    ? `<img src="${escapeHtml(params.logoUrl)}" alt="${safeBrandName}" style="max-height:48px;max-width:180px;display:block;" />`
    : "";

  const productImageBlock = params.productImageUrl
    ? `<tr><td style="padding:0 0 24px 0;text-align:center;"><img src="${escapeHtml(params.productImageUrl)}" alt="${safeAlt}" style="max-width:100%;height:auto;border-radius:8px;display:block;margin:0 auto;" /></td></tr>`
    : "";

  const ctaBlock =
    params.ctaText && params.ctaUrl
      ? `<tr><td style="padding:16px 0 24px 0;text-align:center;"><a href="${escapeHtml(params.ctaUrl)}" style="display:inline-block;padding:12px 28px;background-color:#1a3f92;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">${safeCta}</a></td></tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>${safeBrandName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f1e7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f6f1e7;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">

<!-- Header -->
<tr><td style="padding:24px 32px;border-bottom:1px solid #e8e0d0;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr>
<td style="font-size:18px;font-weight:700;color:#1a3f92;">${logoBlock || safeBrandName}</td>
</tr>
</table>
</td></tr>

<!-- Product Image -->
${productImageBlock ? `<tr><td style="padding:24px 32px 0;">${productImageBlock}</td></tr>` : ""}

<!-- Body -->
<tr><td style="padding:32px;font-size:15px;line-height:1.6;color:#2d2d2d;">
${params.bodyContent}
</td></tr>

<!-- CTA -->
${ctaBlock ? `<tr><td style="padding:0 32px 32px;">${ctaBlock}</td></tr>` : ""}

<!-- Footer -->
<tr><td style="padding:20px 32px;background-color:#faf7f0;border-top:1px solid #e8e0d0;text-align:center;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#8c8274;">
You received this email from ${safeBrandName}.<br/>
<a href="${params.unsubscribeUrl}" style="color:#1a3f92;text-decoration:underline;">Unsubscribe</a>
</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
