import { buildQueryExpansionPrompt, buildSummarizePrompt } from "./prompts";
import { normalizeArticleBody } from "../extract/normalizeArticleBody";
import { isLikelyEnglish, needsEnglishDisplay } from "./languageDetect";
import { QWEN_ESTIMATED_BYTES } from "../model/modelInfo";

const DEVICE_PREF_KEY = "gn-summarizer-device";

export type SummarizerDevice = "webgpu" | "wasm";

export type SummarizerResult = {
  summary: string;
  titleEn?: string;
  keyFacts: string[];
  entities: string[];
  keywords: string[];
};

export type ModelBootPhase = "idle" | "downloading" | "loading" | "ready" | "error";

export type ModelBootState = {
  phase: ModelBootPhase;
  message: string;
  pct: number;
  loaded: number;
  total: number;
  device: string;
  error: string | null;
};

type WorkerIn =
  | { type: "init"; device?: SummarizerDevice }
  | { type: "summarize"; articleText: string; requestId: string }
  | { type: "translate"; title: string; body: string; requestId: string }
  | { type: "expand"; query: string; requestId: string };

type WorkerOut =
  | { type: "ready"; device: string }
  | { type: "progress"; message: string; pct: number; loaded?: number; total?: number; device?: string }
  | { type: "device_switched"; device: string; reason: string }
  | { type: "summarize_done"; requestId: string; result: SummarizerResult }
  | { type: "translate_done"; requestId: string; result: { title: string; summary: string } }
  | { type: "expand_done"; requestId: string; keywords: string[] }
  | { type: "error"; message: string; requestId?: string };

export function getPreferredSummarizerDevice(): SummarizerDevice {
  try {
    return localStorage.getItem(DEVICE_PREF_KEY) === "wasm" ? "wasm" : "webgpu";
  } catch {
    return "webgpu";
  }
}

export function setPreferredSummarizerDevice(device: SummarizerDevice): void {
  try {
    localStorage.setItem(DEVICE_PREF_KEY, device);
  } catch {
    /* ignore */
  }
}

function extractiveFallback(articleText: string): SummarizerResult {
  const { body } = normalizeArticleBody(articleText);
  const first =
    body
      .split(/\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 40 && !/^title:/i.test(l)) ?? body.slice(0, 280);
  return { summary: first.slice(0, 280), keyFacts: [first.slice(0, 120)], entities: [], keywords: [] };
}

let worker: Worker | null = null;
let ready = false;
let bootStarted = false;

function resetWorker() {
  worker?.terminate();
  worker = null;
  ready = false;
  bootStarted = false;
}

let bootState: ModelBootState = {
  phase: "idle",
  message: "Download the model to enable summaries and search.",
  pct: 0,
  loaded: 0,
  total: QWEN_ESTIMATED_BYTES,
  device: "",
  error: null,
};

const bootListeners = new Set<(s: ModelBootState) => void>();
let readyWaiters: Array<(ok: boolean) => void> = [];
const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function emitBoot(patch: Partial<ModelBootState>) {
  bootState = { ...bootState, ...patch };
  bootListeners.forEach((l) => l(bootState));
}

export function getModelBootState(): ModelBootState {
  return bootState;
}

export function subscribeModelBoot(fn: (s: ModelBootState) => void): () => void {
  bootListeners.add(fn);
  fn(bootState);
  return () => bootListeners.delete(fn);
}

function ensureWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./summarizer.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
      const msg = ev.data;
      if (msg.type === "ready") {
        ready = true;
        emitBoot({
          phase: "ready",
          message: "Qwen 2.5 0.5B ready in browser",
          pct: 100,
          device: msg.device ?? bootState.device,
          error: null,
        });
        readyWaiters.forEach((w) => w(true));
        readyWaiters = [];
      } else if (msg.type === "progress") {
        const loaded = msg.loaded ?? bootState.loaded;
        const total = msg.total ?? (bootState.total || QWEN_ESTIMATED_BYTES);
        let pct = msg.pct;
        if (loaded > 0 && total > 0) {
          pct = Math.min(99, Math.round((loaded / total) * 100));
        }
        emitBoot({
          phase: pct >= 99 ? "loading" : "downloading",
          message: msg.message,
          pct,
          loaded,
          total,
          device: msg.device ?? bootState.device,
          error: null,
        });
      } else if (msg.type === "device_switched") {
        if (msg.device === "WASM") setPreferredSummarizerDevice("wasm");
        emitBoot({
          message:
            msg.reason === "inference_failed"
              ? "WebGPU unstable — using WASM (CPU) for summaries"
              : "Using WASM (CPU) for summaries",
          device: msg.device,
        });
      } else if (msg.type === "translate_done") {
        pending.get(msg.requestId)?.resolve(msg.result);
        pending.delete(msg.requestId);
      } else if (msg.type === "summarize_done") {
        pending.get(msg.requestId)?.resolve(msg.result);
        pending.delete(msg.requestId);
      } else if (msg.type === "expand_done") {
        pending.get(msg.requestId)?.resolve(msg.keywords);
        pending.delete(msg.requestId);
      } else if (msg.type === "error") {
        if (msg.requestId) {
          pending.get(msg.requestId)?.reject(new Error(msg.message));
          pending.delete(msg.requestId);
        } else {
          emitBoot({ phase: "error", message: "Model load failed", error: msg.message });
          readyWaiters.forEach((w) => w(false));
          readyWaiters = [];
        }
      }
    };
  }
  return worker;
}

export function isSummarizerReady(): boolean {
  return ready;
}

/** Start model download + WebGPU init — user must click "Download model". */
export function bootSummarizer(force = false): void {
  if (bootStarted && bootState.phase !== "error" && !force) return;
  if (force) resetWorker();
  bootStarted = true;
  ready = false;
  emitBoot({
    phase: "downloading",
    message: "Connecting to Hugging Face cache…",
    pct: 0,
    loaded: 0,
    total: QWEN_ESTIMATED_BYTES,
    error: null,
  });
  const w = ensureWorker();
  w.postMessage({ type: "init", device: getPreferredSummarizerDevice() } satisfies WorkerIn);
}

export async function waitForSummarizer(timeoutMs = 300_000): Promise<boolean> {
  if (ready) return true;
  if (!bootStarted) return false;
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), timeoutMs);
    readyWaiters.push((ok) => {
      clearTimeout(t);
      resolve(ok);
    });
  });
}

function request<T>(msg: WorkerIn): Promise<T> {
  const w = ensureWorker();
  const requestId = "requestId" in msg ? msg.requestId : crypto.randomUUID();
  const full = { ...msg, requestId } as WorkerIn;
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve: resolve as (v: unknown) => void, reject });
    w.postMessage(full);
  });
}

export async function summarizeArticle(articleText: string): Promise<SummarizerResult> {
  if (!articleText.trim()) {
    return { summary: "", keyFacts: [], entities: [], keywords: [] };
  }
  const ok = await waitForSummarizer();
  if (!ok) return extractiveFallback(articleText);
  try {
    return await request<SummarizerResult>({
      type: "summarize",
      articleText: buildSummarizePrompt(articleText),
      requestId: crypto.randomUUID(),
    });
  } catch {
    return extractiveFallback(articleText);
  }
}

const expansionCache = new Map<string, string[]>();

export async function expandQuery(query: string): Promise<string[]> {
  const key = query.trim().toLowerCase();
  if (!key) return [];
  const cached = expansionCache.get(key);
  if (cached) return cached;

  const ok = await waitForSummarizer();
  if (!ok) return [];

  try {
    const keywords = await request<string[]>({
      type: "expand",
      query: buildQueryExpansionPrompt(query),
      requestId: crypto.randomUUID(),
    });
    expansionCache.set(key, keywords);
    return keywords;
  } catch {
    return [];
  }
}

const translateCache = new Map<string, { title: string; summary: string }>();

export async function translateHeadlineToEnglish(title: string, body: string): Promise<{ title: string; summary: string }> {
  const snippet = body.slice(0, 500);
  if (!needsEnglishDisplay(title, snippet)) {
    return { title: title.trim(), summary: snippet.trim() || title.trim() };
  }

  const cacheKey = `${title.slice(0, 80)}::${snippet.slice(0, 120)}`.toLowerCase();
  const cached = translateCache.get(cacheKey);
  if (cached) return cached;

  const ok = await waitForSummarizer(120_000);
  if (!ok) {
    return { title: title.trim(), summary: snippet.trim() || title.trim() };
  }

  try {
    const result = await request<{ title: string; summary: string }>({
      type: "translate",
      title,
      body: snippet,
      requestId: crypto.randomUUID(),
    });
    const out = {
      title: result.title?.trim() || title.trim(),
      summary: result.summary?.trim() || snippet.trim(),
    };
    if (isLikelyEnglish(out.title) || isLikelyEnglish(out.summary)) {
      translateCache.set(cacheKey, out);
    }
    return out;
  } catch {
    return { title: title.trim(), summary: snippet.trim() || title.trim() };
  }
}

export { parseSummarizerOutput } from "./prompts";
