/**
 * Template variable system for HTML email templates.
 *
 * Supports: {{creator.name}}, {{product.name}}, {{product.retailValue}},
 * {{product.imageUrl}}, {{brand.name}}, {{unsubscribe.url}}
 *
 * ALL variable values pass through escapeHtml() before interpolation
 * except {{unsubscribe.url}} which is a pre-built URL (not user content).
 */

import { escapeHtml } from "@/lib/outreach/html-escape";

export type TemplateVariables = {
  readonly creator: {
    readonly name: string;
  };
  readonly product: {
    readonly name: string;
    readonly retailValue?: string;
    readonly imageUrl?: string;
  };
  readonly brand: {
    readonly name: string;
  };
  readonly unsubscribe: {
    readonly url: string;
  };
};

/**
 * Interpolate template variables into a template string.
 *
 * All values are HTML-escaped before insertion, except the unsubscribe URL
 * which is a controlled URL (not user-supplied text).
 */
export function interpolateTemplate(
  template: string,
  vars: TemplateVariables
): string {
  const replacements: ReadonlyArray<readonly [string, string]> = [
    ["{{creator.name}}", escapeHtml(vars.creator.name)],
    ["{{product.name}}", escapeHtml(vars.product.name)],
    [
      "{{product.retailValue}}",
      vars.product.retailValue
        ? escapeHtml(vars.product.retailValue)
        : "",
    ],
    [
      "{{product.imageUrl}}",
      vars.product.imageUrl ? escapeHtml(vars.product.imageUrl) : "",
    ],
    ["{{brand.name}}", escapeHtml(vars.brand.name)],
    // URL is not user content — no escapeHtml needed
    ["{{unsubscribe.url}}", vars.unsubscribe.url],
  ];

  let result = template;
  for (const [token, value] of replacements) {
    result = result.split(token).join(value);
  }

  return result;
}

/**
 * Interpolate template variables into a plain-text template string.
 * No HTML escaping — this is for the text/plain MIME part.
 */
export function interpolateTemplatePlainText(
  template: string,
  vars: TemplateVariables
): string {
  const replacements: ReadonlyArray<readonly [string, string]> = [
    ["{{creator.name}}", vars.creator.name],
    ["{{product.name}}", vars.product.name],
    ["{{product.retailValue}}", vars.product.retailValue ?? ""],
    ["{{product.imageUrl}}", vars.product.imageUrl ?? ""],
    ["{{brand.name}}", vars.brand.name],
    ["{{unsubscribe.url}}", vars.unsubscribe.url],
  ];

  let result = template;
  for (const [token, value] of replacements) {
    result = result.split(token).join(value);
  }

  return result;
}
