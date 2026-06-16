/**
 * Cloudflare Worker — CORS fetch proxy for GROVEE NEWS on GitHub Pages.
 * Deploy: npx wrangler deploy (from workers/fetch-proxy)
 * Set VITE_FETCH_PROXY_URL=https://<name>.<account>.workers.dev in .env.production
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405, headers: CORS });
    }

    const { searchParams } = new URL(request.url);
    const target = searchParams.get("url");
    if (!target) {
      return new Response("Missing url parameter", { status: 400, headers: CORS });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response("Invalid url", { status: 400, headers: CORS });
    }
    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      return new Response("Invalid protocol", { status: 400, headers: CORS });
    }

    const upstream = await fetch(target, {
      headers: {
        "User-Agent": "GROVEE-NEWS/0.1 (cloudflare-fetch-proxy)",
        Accept: request.headers.get("Accept") || "text/html,application/xhtml+xml,application/xml,text/plain,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...CORS,
        "Content-Type": upstream.headers.get("content-type") || "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=120",
      },
    });
  },
};
