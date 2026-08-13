/**
 * Tests for Phase 24c — HTML Email Templates.
 *
 * Covers:
 * - Multipart MIME with both text/plain and text/html parts
 * - Plain-text-only backward compatibility (no bodyHtml)
 * - HTML escaping of template variables (XSS prevention)
 * - <script> in creator name is escaped in HTML output
 * - Unsubscribe link in HTML footer has valid HMAC token
 * - Unsubscribe URL in footer matches List-Unsubscribe header URL
 * - Email size validation warns on >100KB
 * - Base template renders valid HTML (no unclosed tags)
 * - Warmup days 1-3 send plain text only
 * - isInEarlyWarmup behavior
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma to avoid DATABASE_URL requirement when importing gmail/send
vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

// Mock server-only (imported transitively by integrations/state)
vi.mock("server-only", () => ({}));

// ── HTML Escaping ────────────────────────────────────────────

describe("escapeHtml", () => {
  it("escapes all five dangerous characters", async () => {
    const { escapeHtml } = await import("@/lib/outreach/html-escape");
    const input = `<script>alert("xss")&'test'</script>`;
    const escaped = escapeHtml(input);

    expect(escaped).not.toContain("<");
    expect(escaped).not.toContain(">");
    expect(escaped).not.toContain('"');
    expect(escaped).toContain("&lt;");
    expect(escaped).toContain("&gt;");
    expect(escaped).toContain("&quot;");
    expect(escaped).toContain("&#039;");
    expect(escaped).toContain("&amp;");
  });

  it("leaves safe strings unchanged", async () => {
    const { escapeHtml } = await import("@/lib/outreach/html-escape");
    expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
  });

  it("handles empty string", async () => {
    const { escapeHtml } = await import("@/lib/outreach/html-escape");
    expect(escapeHtml("")).toBe("");
  });
});

// ── buildUnsubscribeUrl ──────────────────────────────────────

describe("buildUnsubscribeUrl", () => {
  beforeEach(() => {
    vi.stubEnv("APP_ENCRYPTION_KEY", "test-secret-key-for-hmac");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test.io");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds URL with email and HMAC token", async () => {
    const { buildUnsubscribeUrl } = await import("@/lib/gmail/send");
    const url = buildUnsubscribeUrl("creator@example.com");

    expect(url).toContain("https://app.test.io/api/webhooks/unsubscribe");
    expect(url).toContain("email=creator%40example.com");
    expect(url).toContain("token=");
    // Token should be a hex string (SHA-256 HMAC = 64 hex chars)
    const tokenMatch = url.match(/token=([a-f0-9]+)/);
    expect(tokenMatch).not.toBeNull();
    expect(tokenMatch![1]).toHaveLength(64);
  });

  it("uses default APP_URL when env is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    // Need fresh import to pick up env change
    vi.resetModules();
    const { buildUnsubscribeUrl } = await import("@/lib/gmail/send");
    const url = buildUnsubscribeUrl("test@example.com");

    // Falls back to the default URL
    expect(url).toContain("/api/webhooks/unsubscribe");
  });
});

// ── buildRawEmail ────────────────────────────────────────────

describe("buildRawEmail", () => {
  beforeEach(() => {
    vi.stubEnv("APP_ENCRYPTION_KEY", "test-secret-key-for-hmac");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test.io");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("emits text/plain when no bodyHtml provided (backward compat)", async () => {
    vi.resetModules();
    const { buildRawEmail } = await import("@/lib/gmail/send");

    const raw = buildRawEmail({
      from: "sender@brand.com",
      to: "creator@example.com",
      subject: "Hello",
      body: "Plain text body",
    });

    expect(raw).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(raw).toContain("Plain text body");
    expect(raw).not.toContain("multipart/alternative");
    expect(raw).not.toContain("boundary");
  });

  it("emits multipart/alternative when bodyHtml is provided", async () => {
    vi.resetModules();
    const { buildRawEmail } = await import("@/lib/gmail/send");

    const raw = buildRawEmail({
      from: "sender@brand.com",
      to: "creator@example.com",
      subject: "Hello",
      body: "Plain text body",
      bodyHtml: "<p>HTML body</p>",
    });

    expect(raw).toContain("multipart/alternative");
    expect(raw).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(raw).toContain('Content-Type: text/html; charset="UTF-8"');
    expect(raw).toContain("Plain text body");
    expect(raw).toContain("<p>HTML body</p>");
  });

  it("includes List-Unsubscribe header", async () => {
    vi.resetModules();
    const { buildRawEmail } = await import("@/lib/gmail/send");

    const raw = buildRawEmail({
      from: "sender@brand.com",
      to: "creator@example.com",
      subject: "Hello",
      body: "Body",
    });

    expect(raw).toContain("List-Unsubscribe:");
    expect(raw).toContain("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
  });

  it("unsubscribe URL in List-Unsubscribe header matches buildUnsubscribeUrl", async () => {
    vi.resetModules();
    const { buildRawEmail, buildUnsubscribeUrl } = await import(
      "@/lib/gmail/send"
    );

    const recipientEmail = "creator@example.com";
    const expectedUrl = buildUnsubscribeUrl(recipientEmail);

    const raw = buildRawEmail({
      from: "sender@brand.com",
      to: recipientEmail,
      subject: "Hello",
      body: "Body",
    });

    expect(raw).toContain(`List-Unsubscribe: <${expectedUrl}>`);
  });

  it("uses MIME boundary from crypto.randomUUID", async () => {
    vi.resetModules();
    const { buildRawEmail } = await import("@/lib/gmail/send");

    const raw = buildRawEmail({
      from: "sender@brand.com",
      to: "creator@example.com",
      subject: "Hello",
      body: "Plain text",
      bodyHtml: "<p>HTML</p>",
    });

    // Boundary should contain a UUID pattern
    const boundaryMatch = raw.match(/boundary="(boundary-[a-f0-9-]+)"/);
    expect(boundaryMatch).not.toBeNull();
    // The boundary should appear as a separator in the body
    expect(raw).toContain(`--${boundaryMatch![1]}`);
    expect(raw).toContain(`--${boundaryMatch![1]}--`);
  });

  it("includes In-Reply-To and References headers when provided", async () => {
    vi.resetModules();
    const { buildRawEmail } = await import("@/lib/gmail/send");

    const raw = buildRawEmail({
      from: "sender@brand.com",
      to: "creator@example.com",
      subject: "Re: Hello",
      body: "Reply body",
      inReplyTo: "<msg-123@gmail.com>",
      references: "<msg-123@gmail.com>",
    });

    expect(raw).toContain("In-Reply-To: <msg-123@gmail.com>");
    expect(raw).toContain("References: <msg-123@gmail.com>");
  });

  it("warns when email exceeds 100KB", async () => {
    vi.resetModules();
    const { buildRawEmail } = await import("@/lib/gmail/send");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const largeBody = "x".repeat(105 * 1024);
    buildRawEmail({
      from: "sender@brand.com",
      to: "creator@example.com",
      subject: "Hello",
      body: largeBody,
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("may be clipped by Gmail")
    );
    warnSpy.mockRestore();
  });

  it("does not warn for normal-sized emails", async () => {
    vi.resetModules();
    const { buildRawEmail } = await import("@/lib/gmail/send");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    buildRawEmail({
      from: "sender@brand.com",
      to: "creator@example.com",
      subject: "Hello",
      body: "Short body",
    });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ── Base Template ────────────────────────────────────────────

describe("renderBaseTemplate", () => {
  it("renders valid HTML with no unclosed tags", async () => {
    const { renderBaseTemplate } = await import(
      "@/lib/outreach/templates/base"
    );

    const html = renderBaseTemplate({
      bodyContent: "<p>Hello World</p>",
      brandName: "TestBrand",
      unsubscribeUrl: "https://example.com/unsub",
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
    expect(html).toContain("</body>");
    expect(html).toContain("</table>");
    // Check that opening/closing html tags are balanced
    const openHtml = (html.match(/<html/g) || []).length;
    const closeHtml = (html.match(/<\/html>/g) || []).length;
    expect(openHtml).toBe(closeHtml);
  });

  it("includes brand name in header", async () => {
    const { renderBaseTemplate } = await import(
      "@/lib/outreach/templates/base"
    );

    const html = renderBaseTemplate({
      bodyContent: "<p>Content</p>",
      brandName: "Acme Co",
      unsubscribeUrl: "https://example.com/unsub",
    });

    expect(html).toContain("Acme Co");
  });

  it("includes unsubscribe link in footer", async () => {
    const { renderBaseTemplate } = await import(
      "@/lib/outreach/templates/base"
    );

    const html = renderBaseTemplate({
      bodyContent: "<p>Content</p>",
      brandName: "TestBrand",
      unsubscribeUrl: "https://app.test.io/api/webhooks/unsubscribe?email=test%40test.com&token=abc123",
    });

    expect(html).toContain("Unsubscribe");
    expect(html).toContain(
      "https://app.test.io/api/webhooks/unsubscribe?email=test%40test.com&token=abc123"
    );
  });

  it("escapes brand name for XSS prevention", async () => {
    const { renderBaseTemplate } = await import(
      "@/lib/outreach/templates/base"
    );

    const html = renderBaseTemplate({
      bodyContent: "<p>Content</p>",
      brandName: '<script>alert("xss")</script>',
      unsubscribeUrl: "https://example.com/unsub",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders product image when provided", async () => {
    const { renderBaseTemplate } = await import(
      "@/lib/outreach/templates/base"
    );

    const html = renderBaseTemplate({
      bodyContent: "<p>Content</p>",
      brandName: "TestBrand",
      productImageUrl: "https://cdn.example.com/product.jpg",
      productImageAlt: "Cool Product",
      unsubscribeUrl: "https://example.com/unsub",
    });

    expect(html).toContain("https://cdn.example.com/product.jpg");
    expect(html).toContain("Cool Product");
  });

  it("renders CTA button when provided", async () => {
    const { renderBaseTemplate } = await import(
      "@/lib/outreach/templates/base"
    );

    const html = renderBaseTemplate({
      bodyContent: "<p>Content</p>",
      brandName: "TestBrand",
      ctaText: "Learn More",
      ctaUrl: "https://example.com/product",
      unsubscribeUrl: "https://example.com/unsub",
    });

    expect(html).toContain("Learn More");
    expect(html).toContain("https://example.com/product");
  });

  it("omits product image block when not provided", async () => {
    const { renderBaseTemplate } = await import(
      "@/lib/outreach/templates/base"
    );

    const html = renderBaseTemplate({
      bodyContent: "<p>Content</p>",
      brandName: "TestBrand",
      unsubscribeUrl: "https://example.com/unsub",
    });

    // Should not have an img tag for product
    expect(html).not.toContain("Product image");
  });
});

// ── Template Variables ───────────────────────────────────────

describe("interpolateTemplate", () => {
  it("replaces all template variables with HTML-escaped values", async () => {
    const { interpolateTemplate } = await import(
      "@/lib/outreach/templates/variables"
    );

    const template = "Hello {{creator.name}} from {{brand.name}}!";
    const result = interpolateTemplate(template, {
      creator: { name: "Alice" },
      product: { name: "Widget" },
      brand: { name: "Acme" },
      unsubscribe: { url: "https://example.com/unsub" },
    });

    expect(result).toBe("Hello Alice from Acme!");
  });

  it("HTML-escapes creator name with special characters", async () => {
    const { interpolateTemplate } = await import(
      "@/lib/outreach/templates/variables"
    );

    const template = "Hi {{creator.name}}";
    const result = interpolateTemplate(template, {
      creator: { name: '<script>alert("xss")</script>' },
      product: { name: "Widget" },
      brand: { name: "Acme" },
      unsubscribe: { url: "https://example.com/unsub" },
    });

    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("does not HTML-escape the unsubscribe URL", async () => {
    const { interpolateTemplate } = await import(
      "@/lib/outreach/templates/variables"
    );

    const template = "Unsub: {{unsubscribe.url}}";
    const result = interpolateTemplate(template, {
      creator: { name: "Alice" },
      product: { name: "Widget" },
      brand: { name: "Acme" },
      unsubscribe: {
        url: "https://example.com/unsub?email=a%40b.com&token=abc",
      },
    });

    // The URL should remain intact (& not escaped to &amp;)
    expect(result).toContain(
      "https://example.com/unsub?email=a%40b.com&token=abc"
    );
  });

  it("handles empty optional variables", async () => {
    const { interpolateTemplate } = await import(
      "@/lib/outreach/templates/variables"
    );

    const template = "Product: {{product.name}} ({{product.retailValue}})";
    const result = interpolateTemplate(template, {
      creator: { name: "Alice" },
      product: { name: "Widget" },
      brand: { name: "Acme" },
      unsubscribe: { url: "https://example.com/unsub" },
    });

    expect(result).toBe("Product: Widget ()");
  });
});

describe("interpolateTemplatePlainText", () => {
  it("replaces variables without HTML escaping", async () => {
    const { interpolateTemplatePlainText } = await import(
      "@/lib/outreach/templates/variables"
    );

    const template = "Hi {{creator.name}} from {{brand.name}}";
    const result = interpolateTemplatePlainText(template, {
      creator: { name: "Alice & Bob" },
      product: { name: "Widget" },
      brand: { name: "Acme" },
      unsubscribe: { url: "https://example.com/unsub" },
    });

    // Plain text should NOT escape ampersand
    expect(result).toBe("Hi Alice & Bob from Acme");
  });
});

// ── Default Templates ────────────────────────────────────────

describe("default templates", () => {
  const vars = {
    creator: { name: "TestCreator" },
    product: {
      name: "SuperWidget",
      retailValue: "$49.99",
      imageUrl: "https://cdn.example.com/product.jpg",
    },
    brand: { name: "TestBrand" },
    unsubscribe: { url: "https://app.test.io/unsub" },
  } as const;

  it("renderInitialOutreach returns subject, bodyHtml, and bodyText", async () => {
    const { renderInitialOutreach } = await import(
      "@/lib/outreach/templates/initial-outreach"
    );
    const result = renderInitialOutreach(vars);

    expect(result.subject).toContain("TestBrand");
    expect(result.bodyHtml).toContain("<!DOCTYPE html>");
    expect(result.bodyHtml).toContain("TestCreator");
    expect(result.bodyHtml).toContain("SuperWidget");
    expect(result.bodyHtml).toContain("Unsubscribe");
    expect(result.bodyText).toContain("TestCreator");
    expect(result.bodyText).toContain("SuperWidget");
    expect(result.bodyText).toContain("unsub");
  });

  it("renderFollowUp returns subject, bodyHtml, and bodyText", async () => {
    const { renderFollowUp } = await import(
      "@/lib/outreach/templates/follow-up"
    );
    const result = renderFollowUp(vars);

    expect(result.subject).toContain("TestBrand");
    expect(result.bodyHtml).toContain("<!DOCTYPE html>");
    expect(result.bodyHtml).toContain("follow up");
    expect(result.bodyText).toContain("follow up");
  });

  it("renderAddressRequest returns subject, bodyHtml, and bodyText", async () => {
    const { renderAddressRequest } = await import(
      "@/lib/outreach/templates/address-request"
    );
    const result = renderAddressRequest(vars);

    expect(result.subject).toContain("SuperWidget");
    expect(result.bodyHtml).toContain("<!DOCTYPE html>");
    expect(result.bodyHtml).toContain("shipping address");
    expect(result.bodyText).toContain("shipping address");
  });

  it("escapes <script> in creator name in initial outreach HTML", async () => {
    const { renderInitialOutreach } = await import(
      "@/lib/outreach/templates/initial-outreach"
    );
    const maliciousVars = {
      ...vars,
      creator: { name: '<script>alert("xss")</script>' },
    };
    const result = renderInitialOutreach(maliciousVars);

    expect(result.bodyHtml).not.toContain("<script>");
    expect(result.bodyHtml).toContain("&lt;script&gt;");
    // Plain text should have the raw script tag (it's plain text, not HTML)
    expect(result.bodyText).toContain("<script>");
  });
});

// ── Warmup Gate (isInEarlyWarmup) ────────────────────────────

const MS_PER_DAY = 86_400_000;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * MS_PER_DAY);
}

describe("isInEarlyWarmup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false when alias is warmed up", async () => {
    const { isInEarlyWarmup } = await import("@/lib/outreach/warmup");
    expect(
      isInEarlyWarmup({
        isWarmedUp: true,
        warmupStartedAt: new Date(),
        dailyLimit: 50,
      })
    ).toBe(false);
  });

  it("returns true when warmupStartedAt is null", async () => {
    const { isInEarlyWarmup } = await import("@/lib/outreach/warmup");
    expect(
      isInEarlyWarmup({
        isWarmedUp: false,
        warmupStartedAt: null,
        dailyLimit: 50,
      })
    ).toBe(true);
  });

  it("returns true on day 1", async () => {
    const { isInEarlyWarmup } = await import("@/lib/outreach/warmup");
    expect(
      isInEarlyWarmup({
        isWarmedUp: false,
        warmupStartedAt: new Date(),
        dailyLimit: 50,
      })
    ).toBe(true);
  });

  it("returns true on day 3", async () => {
    const { isInEarlyWarmup } = await import("@/lib/outreach/warmup");
    expect(
      isInEarlyWarmup({
        isWarmedUp: false,
        warmupStartedAt: daysAgo(2),
        dailyLimit: 50,
      })
    ).toBe(true);
  });

  it("returns false on day 4", async () => {
    const { isInEarlyWarmup } = await import("@/lib/outreach/warmup");
    expect(
      isInEarlyWarmup({
        isWarmedUp: false,
        warmupStartedAt: daysAgo(3),
        dailyLimit: 50,
      })
    ).toBe(false);
  });

  it("returns false on day 7", async () => {
    const { isInEarlyWarmup } = await import("@/lib/outreach/warmup");
    expect(
      isInEarlyWarmup({
        isWarmedUp: false,
        warmupStartedAt: daysAgo(6),
        dailyLimit: 50,
      })
    ).toBe(false);
  });

  it("returns false on day 15+", async () => {
    const { isInEarlyWarmup } = await import("@/lib/outreach/warmup");
    expect(
      isInEarlyWarmup({
        isWarmedUp: false,
        warmupStartedAt: daysAgo(14),
        dailyLimit: 50,
      })
    ).toBe(false);
  });
});
