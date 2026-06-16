import type { Connect } from "vite";
import type { Plugin, PreviewServer, ViteDevServer } from "vite";

const PROXY_PATH = "/api/fetch";

function proxyMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (!req.url?.startsWith(PROXY_PATH)) {
      next();
      return;
    }

    try {
      const parsed = new URL(req.url, "http://127.0.0.1");
      const target = parsed.searchParams.get("url");
      if (!target) {
        res.statusCode = 400;
        res.end("Missing url parameter");
        return;
      }

      const targetUrl = new URL(target);
      if (!["http:", "https:"].includes(targetUrl.protocol)) {
        res.statusCode = 400;
        res.end("Invalid protocol");
        return;
      }

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25_000);
      const headers: Record<string, string> = {
        "User-Agent": "GROVEE-NEWS/0.1 (local RSS proxy)",
        Accept: "text/html,application/xhtml+xml,application/xml,application/json,text/plain,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      };
      if (targetUrl.hostname === "api.github.com" && process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      }
      const response = await fetch(target, {
        signal: ctrl.signal,
        headers,
        redirect: "follow",
      });
      clearTimeout(timer);

      const text = await response.text();
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", response.headers.get("content-type") || "text/plain; charset=utf-8");
      res.statusCode = response.status;
      res.end(text);
    } catch (err) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(err instanceof Error ? err.message : "Proxy fetch failed");
    }
  };
}

function attach(server: ViteDevServer | PreviewServer) {
  server.middlewares.use(proxyMiddleware());
}

/** Server-side fetch proxy — bypasses browser CORS for RSS + articles in dev/preview. */
export function fetchProxyPlugin(): Plugin {
  return {
    name: "grovee-fetch-proxy",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
