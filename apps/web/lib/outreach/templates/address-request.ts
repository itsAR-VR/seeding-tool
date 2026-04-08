/**
 * Address request HTML email template.
 *
 * Sent after a creator expresses interest, to collect their
 * shipping address for product fulfillment.
 */

import { renderBaseTemplate } from "./base";
import {
  interpolateTemplate,
  interpolateTemplatePlainText,
  type TemplateVariables,
} from "./variables";

const HTML_BODY_TEMPLATE = `<p>Hi {{creator.name}},</p>
<p>Thank you for your interest in trying {{product.name}}! We are excited to get it to you.</p>
<p>Could you reply with your shipping address so we can send it out? Here is what we need:</p>
<ul style="margin:12px 0;padding-left:20px;color:#2d2d2d;">
<li>Full name</li>
<li>Street address</li>
<li>City, state, zip code</li>
<li>Country</li>
</ul>
<p>We will get {{product.name}} shipped to you as soon as we have your details.</p>
<p>Best,<br/>The {{brand.name}} Team</p>`;

const PLAIN_TEXT_TEMPLATE = `Hi {{creator.name}},

Thank you for your interest in trying {{product.name}}! We are excited to get it to you.

Could you reply with your shipping address so we can send it out? Here is what we need:

- Full name
- Street address
- City, state, zip code
- Country

We will get {{product.name}} shipped to you as soon as we have your details.

Best,
The {{brand.name}} Team

Unsubscribe: {{unsubscribe.url}}`;

export type TemplateOutput = {
  readonly subject: string;
  readonly bodyHtml: string;
  readonly bodyText: string;
};

/**
 * Render the address request template with the given variables.
 */
export function renderAddressRequest(
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
    subject: `Shipping details for ${vars.product.name}`,
    bodyHtml,
    bodyText,
  };
}
