# GROVEE NEWS

Standalone browser-native news intelligence engine. **Not connected to GROVEE / GROVEEMODEL.**

## Run locally

```bat
start-local.bat
```

Or:

```bash
npm install
npm run dev
```

Open **http://127.0.0.1:5190/**

## Stack

- Vite + React + TypeScript
- 52 English RSS feeds (incl. 16 Israel English sources)
- Mozilla Readability + DOMPurify + Turndown
- IndexedDB (Dexie)
- FlexSearch
- Fuse.js duplicate clustering
- Qwen 2.5 0.5B Instruct (ONNX, WebGPU → WASM fallback)
- GitHub Pages ready (`base: ./`)

## Port

**5190** — independent from any other project.

## GitHub Pages (live demo)

After deploy: **https://theicd.github.io/GROVEE-NEWS/**

### Static hosting (no `/api/fetch`)

GitHub Pages is static only. The app ships a **build-time RSS cache** (`npm run build:pages`) so the first feed poll works without CORS.

| Feature | `npm run dev` | GitHub Pages |
|---------|---------------|--------------|
| RSS poll (first load) | Live | From `rss-cache.json` baked at build |
| RSS refresh | Live via `/api/fetch` | Needs fetch proxy (see below) |
| Search on cached DB | Yes | Yes |
| Full-page extract + Qwen | Yes | Needs fetch proxy |

### Live fetch on Pages (optional)

Deploy the Cloudflare Worker in `workers/fetch-proxy/`:

```bash
cd workers/fetch-proxy
npx wrangler login
npx wrangler deploy
```

Then set in `.env.production`:

```
VITE_FETCH_PROXY_URL=https://grovee-news-fetch.<your-subdomain>.workers.dev
```

Rebuild with `npm run build:pages` and redeploy `dist/`.

**To test search:** open site → ENGINE → Refresh feeds → search `nasa`, `israel`, `openai`.

For full live RSS + article extraction, use local dev (`start-local.bat` on port 5190).
