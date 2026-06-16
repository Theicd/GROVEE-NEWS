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

Push to `main` triggers `.github/workflows/deploy-pages.yml` (test + build + Pages).

### What works on Pages vs local dev

| Feature | `npm run dev` (local) | GitHub Pages |
|---------|----------------------|--------------|
| UI + search on cached DB | Yes | Yes |
| RSS poll | Yes (via `/api/fetch` proxy) | Partial (public CORS relays) |
| Full-page extract + Qwen | Yes | Partial (depends on relays) |
| IndexedDB | Per browser | Per browser |

**To test search:** open the site → Engage (optional Qwen) → ENGINE → Refresh feeds → wait → search `nasa`, `israel`, `tech`.

For full RSS + article extraction reliability, use local dev (`start-local.bat`).
