/**
 * Follow-up HTML email template.
 *
 * Used for follow-up emails when a creator has not responded
 * to the initial outreach.
 */

import { renderBaseTemplate } from "./base";
import {
  interpolateTemplate,
  interpolateTemplatePlainText,
  type TemplateVariables,
} from "./variables";

const HTML_BODY_TEMPLATE = `<p>Hi {{creator.name}},</p>
<p>Just wanted to follow up on my previous email about trying {{product.name}} from {{brand.name}}.</p>
<p>We think your audience would genuinely appreciate hearing about it, and we would love to send it your way — no strings attached.</p>
<p>If you are interested, just let me know and I can share more details.</p>
<p>Best,<br/>The {{brand.name}} Team</p>`;

const PLAIN_TEXT_TEMPLATE = `Hi {{creator.name}},

Just wanted to follow up on my previous email about trying {{product.name}} from {{brand.name}}.

We think your audience would genuinely appreciate hearing about it, and we would love to send it your way — no strings attached.

If you are interested, just let me know and I can share more details.

Best,
The {{brand.name}} Team

Unsubscribe: {{unsubscribe.url}}`;

export type TemplateOutput = {
  readonly subject: string;
  readonly bodyHtml: string;
  readonly bodyText: string;
};

/**
 * Render the follow-up template with the given variables.
 */
export function renderFollowUp(vars: TemplateVariables): TemplateOutput {
  const bodyContent = interpolateTemplate(HTML_BODY_TEMPLATE, vars);
  const bodyText = interpolateTemplatePlainText(PLAIN_TEXT_TEMPLATE, vars);

  const bodyHtml = renderBaseTemplate({
    bodyContent,
    brandName: vars.brand.name,
    unsubscribeUrl: vars.unsubscribe.url,
  });

  return {
    subject: `Following up — ${vars.product.name} from ${vars.brand.name}`,
    bodyHtml,
    bodyText,
  };
}
