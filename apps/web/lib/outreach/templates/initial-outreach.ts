/**
 * Initial outreach HTML email template.
 *
 * Used for first-touch emails to creators. Includes product image,
 * branded header, and CTA.
 */

import { renderBaseTemplate } from "./base";
import {
  interpolateTemplate,
  interpolateTemplatePlainText,
  type TemplateVariables,
} from "./variables";

const HTML_BODY_TEMPLATE = `<p>Hi {{creator.name}},</p>
<p>I came across your content and think you would be a great fit to try <strong>{{product.name}}</strong> from {{brand.name}}.</p>
<p>We would love to send you {{product.name}} (valued at {{product.retailValue}}) to experience firsthand. If you enjoy it, we would be thrilled if you shared your honest thoughts with your audience.</p>
<p>No obligations — just a genuine product for genuine feedback.</p>
<p>Would you be interested? Just reply to this email and we can get things moving.</p>
<p>Best,<br/>The {{brand.name}} Team</p>`;

const PLAIN_TEXT_TEMPLATE = `Hi {{creator.name}},

I came across your content and think you would be a great fit to try {{product.name}} from {{brand.name}}.

We would love to send you {{product.name}} (valued at {{product.retailValue}}) to experience firsthand. If you enjoy it, we would be thrilled if you shared your honest thoughts with your audience.

No obligations — just a genuine product for genuine feedback.

Would you be interested? Just reply to this email and we can get things moving.

Best,
The {{brand.name}} Team

Unsubscribe: {{unsubscribe.url}}`;

export type TemplateOutput = {
  readonly subject: string;
  readonly bodyHtml: string;
  readonly bodyText: string;
};

/**
 * Render the initial outreach template with the given variables.
 */
export function renderInitialOutreach(
  vars: TemplateVariables
): TemplateOutput {
  const bodyContent = interpolateTemplate(HTML_BODY_TEMPLATE, vars);
  const bodyText = interpolateTemplatePlainText(PLAIN_TEXT_TEMPLATE, vars);

  const bodyHtml = renderBaseTemplate({
    bodyContent,
    brandName: vars.brand.name,
    productImageUrl: vars.product.imageUrl,
    productImageAlt: vars.product.name,
    unsubscribeUrl: vars.unsubscribe.url,
  });

  return {
    subject: `Collaboration with ${vars.brand.name} — ${vars.product.name}`,
    bodyHtml,
    bodyText,
  };
}
