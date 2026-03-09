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

const server = http.createServer(async (req, res) => {
  const requestId = req.headers["fly-request-id"] || randomUUID();
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

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

  if (req.method === "POST" && url.pathname === "/v1/search") {
    if (!isAuthorized(req)) {
      return sendJson(res, 401, {
        error: "unauthorized",
        requestId,
      });
    }

    try {
      const body = await readJsonBody(req);

      // --- real search pipeline ---
      const { campaignId, brandId, criteria, brandIdentity, icpCategories, creators } = body;

      if (!creators || creators.length === 0) {
        return sendJson(res, 200, { results: [], message: "no_creators_provided" });
      }

      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true });
      const results = [];

      for (const creator of creators.slice(0, 10)) {
        try {
          const profileUrl = creator.instagramUrl || creator.collabstrUrl;
          let profileText = creator.profileDump || creator.bio || "";

          if (profileUrl && !creator.profileDump) {
            const page = await browser.newPage();
            try {
              await page.goto(profileUrl, { timeout: 15000, waitUntil: "domcontentloaded" });
              profileText = await page.evaluate(() => document.body?.innerText || "");
            } catch { /* use fallback */ } finally {
              await page.close();
            }
          }

          // OpenAI brand fit scoring
          const openaiKey = process.env.OPENAI_API_KEY;
          if (!openaiKey) throw new Error("OPENAI_API_KEY not set");

          const prompt = `You are a brand partnership analyst. Score creator-brand fit.

Brand: ${brandIdentity || "wellness/sleep brand"}
Creator handle: ${creator.instagram || creator.name || "unknown"}
Creator niche: ${creator.niche || "unknown"}
Creator bio/profile snippet: ${(profileText || "").slice(0, 800)}

Rate fit 0.0-1.0. Reply JSON only: {"score": 0.0-1.0, "reasoning": "1-2 sentence reason", "approved": true/false}
Approved if score >= 0.65.`;

          const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
              response_format: { type: "json_object" },
              max_tokens: 150,
            }),
          });

          const oaiData = await oaiRes.json();
          const parsed = JSON.parse(oaiData.choices?.[0]?.message?.content || "{}");

          results.push({
            handle: creator.instagram || creator.name,
            collabstrSlug: creator.collabstrSlug,
            niche: creator.niche,
            followerCount: creator.followerCount,
            fitScore: parsed.score ?? 0,
            fitReasoning: parsed.reasoning ?? "",
            approved: parsed.approved ?? false,
            instagramUrl: creator.instagramUrl,
          });
        } catch (err) {
          results.push({
            handle: creator.instagram || creator.name,
            collabstrSlug: creator.collabstrSlug,
            fitScore: 0,
            fitReasoning: `analysis_error: ${err.message}`,
            approved: false,
            error: true,
          });
        }
      }

      await browser.close();
      return sendJson(res, 200, { results, analyzed: results.length });
    } catch (error) {
      const code = error instanceof Error ? error.message : "unknown_error";
      const status = code === "payload_too_large" ? 413 : 400;
      return sendJson(res, status, {
        error: code,
        requestId,
      });
    }
  }

  return sendJson(res, 404, {
    error: "not_found",
    requestId,
  });
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
