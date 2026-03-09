import http from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";

const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "0.0.0.0";
const workerToken = process.env.CREATOR_SEARCH_WORKER_TOKEN || "";
const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
const serviceVersion = process.env.RELEASE_COMMAND || process.env.FLY_IMAGE_REF || "local";

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  res.end(payload);
}

function readJsonBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("payload_too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("invalid_json"));
      }
    });

    req.on("error", reject);
  });
}

function isAuthorized(req) {
  if (!workerToken) {
    return false;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return false;
  }

  const token = header.slice("Bearer ".length);
  const expected = Buffer.from(workerToken);
  const actual = Buffer.from(token);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Build a rich brand-context scoring prompt.
 *
 * Uses all available context in priority order:
 *   1. Persona systemPrompt (brand-configured AI persona)
 *   2. Persona tone + name
 *   3. Products (campaign-specific product context)
 *   4. brandIdentity summary (derived ICP string)
 *   5. Creator profile data
 *
 * Output: strict JSON { score, reasoning, approved, confidence, signals }
 */
function buildScoringPrompt({ brandIdentity, persona, products, approvalThreshold, creator, profileText }) {
  const threshold = typeof approvalThreshold === "number" ? approvalThreshold : 0.65;
  const handle = creator.instagram || creator.name || "unknown";
  const niche = creator.niche || "unknown";
  const followers = creator.followerCount != null ? creator.followerCount.toLocaleString() : "unknown";
  const snippet = (profileText || creator.bio || "").slice(0, 1000);

  // System context block — prefer persona.systemPrompt if available
  const systemBlock = persona?.systemPrompt
    ? `=== BRAND PERSONA INSTRUCTIONS ===\n${persona.systemPrompt.trim()}\n===`
    : `=== BRAND CONTEXT ===\n${brandIdentity || "Brand context not provided."}\n===`;

  // Persona tone hint
  const toneHint = persona?.tone
    ? `Evaluate through the lens of a ${persona.tone} brand voice.`
    : "";

  // Product context
  const productLines =
    Array.isArray(products) && products.length > 0
      ? `Campaign products: ${products
          .slice(0, 5)
          .map((p) => (p.description ? `${p.name} (${p.description})` : p.name))
          .join("; ")}`
      : "";

  return `${systemBlock}

You are an expert influencer partnership analyst scoring creator-brand fit.
${toneHint}

Brand summary: ${brandIdentity || "Not provided"}
${productLines}

Creator to evaluate:
- Handle: @${handle}
- Niche: ${niche}
- Followers: ${followers}
- Bio/profile excerpt: ${snippet || "(no data)"}

Scoring rubric (weight each dimension equally):
1. Niche alignment — does the creator's content area match the brand's category/products?
2. Audience fit — would this creator's followers be receptive to this brand?
3. Brand voice compatibility — does the creator's tone/style match the brand persona?
4. Content quality signals — (infer from bio/profile text; professional, authentic, engaged)

Approved if aggregate score >= ${threshold}.

Reply with valid JSON ONLY (no markdown, no extra text):
{
  "score": 0.00,
  "reasoning": "2-3 sentence explanation covering strongest signals for and against",
  "approved": false,
  "confidence": "high|medium|low",
  "signals": {
    "nicheAlignment": 0.0,
    "audienceFit": 0.0,
    "brandVoiceMatch": 0.0,
    "contentQuality": 0.0
  }
}`;
}

const server = http.createServer(async (req, res) => {
  const requestId = req.headers["fly-request-id"] || randomUUID();
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  // ── Health ──────────────────────────────────────────────────────────────
  if (req.method === "GET" && (url.pathname === "/healthz" || url.pathname === "/readyz")) {
    return sendJson(res, 200, {
      ok: true,
      service: "creator-search-worker",
      env: appEnv,
      authConfigured: Boolean(workerToken),
      version: serviceVersion,
      requestId,
      ts: new Date().toISOString(),
    });
  }

  // ── Creator scoring ─────────────────────────────────────────────────────
  if (req.method === "POST" && url.pathname === "/v1/search") {
    if (!isAuthorized(req)) {
      return sendJson(res, 401, { error: "unauthorized", requestId });
    }

    try {
      const body = await readJsonBody(req);

      const {
        campaignId,
        brandId,
        criteria,
        brandIdentity,
        icpCategories,
        creators,
        // New fields — persona context and campaign products
        persona,       // { name?, tone?, systemPrompt? }
        products,      // [{ name, description? }]
        approvalThreshold, // number 0-1, default 0.65
      } = body;

      if (!creators || creators.length === 0) {
        return sendJson(res, 200, { results: [], message: "no_creators_provided" });
      }

      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        return sendJson(res, 500, { error: "OPENAI_API_KEY_not_set", requestId });
      }

      const threshold = typeof approvalThreshold === "number"
        ? Math.min(Math.max(approvalThreshold, 0), 1)
        : 0.65;

      const { chromium } = await import("playwright");
      const browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });

      const results = [];
      const batchSize = Math.min(creators.length, 10);

      for (let i = 0; i < batchSize; i++) {
        const creator = creators[i];

        try {
          const profileUrl = creator.instagramUrl || creator.collabstrUrl;
          let profileText = creator.profileDump || creator.bio || "";

          // Real Playwright profile enrichment — scrape profile page if we have a URL
          // and no pre-fetched dump
          if (profileUrl && !creator.profileDump) {
            const page = await browser.newPage();
            try {
              await page.goto(profileUrl, {
                timeout: 15000,
                waitUntil: "domcontentloaded",
              });
              profileText = await page.evaluate(() => document.body?.innerText || "");
            } catch (scrapeErr) {
              // Non-fatal — fall through to bio/empty
              console.log(JSON.stringify({
                level: "warn",
                msg: "playwright_scrape_failed",
                url: profileUrl,
                error: scrapeErr?.message,
                requestId,
              }));
            } finally {
              await page.close();
            }
          }

          // Build brand-aware scoring prompt
          const prompt = buildScoringPrompt({
            brandIdentity,
            persona,
            products,
            approvalThreshold: threshold,
            creator,
            profileText,
          });

          // OpenAI scoring call
          const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openaiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              response_format: { type: "json_object" },
              max_tokens: 300,
              temperature: 0.1,
            }),
          });

          if (!oaiRes.ok) {
            const errText = await oaiRes.text();
            throw new Error(`openai_http_${oaiRes.status}: ${errText.slice(0, 200)}`);
          }

          const oaiData = await oaiRes.json();
          const rawContent = oaiData.choices?.[0]?.message?.content || "{}";

          let parsed;
          try {
            parsed = JSON.parse(rawContent);
          } catch {
            parsed = {};
          }

          const fitScore = typeof parsed.score === "number"
            ? Math.min(Math.max(parsed.score, 0), 1)
            : 0;

          results.push({
            handle: creator.instagram || creator.name,
            collabstrSlug: creator.collabstrSlug,
            niche: creator.niche,
            followerCount: creator.followerCount,
            fitScore,
            fitReasoning: parsed.reasoning ?? "",
            approved: typeof parsed.approved === "boolean"
              ? parsed.approved
              : fitScore >= threshold,
            confidence: parsed.confidence ?? "medium",
            signals: parsed.signals ?? null,
            instagramUrl: creator.instagramUrl,
            profileScraped: Boolean(profileUrl && !creator.profileDump),
          });
        } catch (err) {
          results.push({
            handle: creator.instagram || creator.name,
            collabstrSlug: creator.collabstrSlug,
            fitScore: 0,
            fitReasoning: `analysis_error: ${err.message}`,
            approved: false,
            confidence: "low",
            signals: null,
            error: true,
          });
        }
      }

      await browser.close();

      return sendJson(res, 200, {
        results,
        analyzed: results.length,
        approvalThreshold: threshold,
        personaUsed: Boolean(persona?.systemPrompt),
        productsProvided: Array.isArray(products) ? products.length : 0,
        requestId,
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "unknown_error";
      const status = code === "payload_too_large" ? 413 : 400;

      console.log(JSON.stringify({
        level: "error",
        msg: "search_handler_error",
        error: code,
        requestId,
      }));

      return sendJson(res, status, { error: code, requestId });
    }
  }

  return sendJson(res, 404, { error: "not_found", requestId });
});

server.listen(port, host, () => {
  console.log(
    JSON.stringify({
      level: "info",
      msg: "creator-search-worker listening",
      host,
      port,
      env: appEnv,
      authConfigured: Boolean(workerToken),
    })
  );
});

function shutdown(signal) {
  console.log(JSON.stringify({ level: "info", msg: `received ${signal}, shutting down` }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
