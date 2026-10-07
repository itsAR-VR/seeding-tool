/**
 * Personal-looking HTML email: plain paragraphs, no header, logo or boxed
 * layout, so outreach reads like a normal note from a person. Keeps a small
 * visible unsubscribe line (CAN-SPAM) in addition to the List-Unsubscribe header.
 */
import { escapeHtml } from "@/lib/outreach/html-escape";

export function renderPersonalTemplate(params: {
  /** Pre-escaped HTML body content */
  readonly bodyContent: string;
  /** Unsubscribe URL (pre-built, not user content) */
  readonly unsubscribeUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222222;">
${params.bodyContent}
<p style="margin-top:32px;font-size:11px;color:#999999;">Not interested? <a href="${escapeHtml(params.unsubscribeUrl)}" style="color:#999999;">Unsubscribe</a></p>
</div>
</body>
</html>`;
}
